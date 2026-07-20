import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { authMiddleware } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';

const router = Router();

const ACCESS_EXPIRY = '15m';
const REFRESH_EXPIRY_DAYS = 7;

// ─── Validation Schemas ───

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().uuid('Invalid refresh token'),
});

// ─── Helper Functions ───

async function generateTokens(userId: string, req: Request) {
  const accessToken = jwt.sign({ userId }, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRY,
  });

  const refreshToken = uuid();
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      refreshToken,
      expiresAt,
      userAgent: req.headers['user-agent'] || null,
      ipAddress: req.ip || null,
    },
  });

  return { accessToken, refreshToken };
}

function sanitizeUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}

// ─── Routes ───

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, username, password } = req.body;

      // Check if user already exists
      const existing = await prisma.user.findFirst({
        where: {
          OR: [{ email: email.toLowerCase() }, { username }],
        },
      });

      if (existing) {
        const field = existing.email === email.toLowerCase() ? 'email' : 'username';
        res.status(409).json({
          error: `This ${field} is already taken`,
          code: 'CONFLICT',
        });
        return;
      }

      // Hash password (cost factor 12 ≈ 250ms)
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          passwordHash,
        },
      });

      const tokens = await generateTokens(user.id, req);

      logger.info({ userId: user.id, username }, 'User registered');

      res.status(201).json({
        user: sanitizeUser(user),
        ...tokens,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (!user) {
        res.status(401).json({
          error: 'Invalid email or password',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        res.status(401).json({
          error: 'Invalid email or password',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      const tokens = await generateTokens(user.id, req);

      logger.info({ userId: user.id }, 'User logged in');

      res.json({
        user: sanitizeUser(user),
        ...tokens,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      const session = await prisma.session.findUnique({
        where: { refreshToken },
      });

      if (!session) {
        res.status(401).json({
          error: 'Invalid refresh token',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      if (session.expiresAt < new Date()) {
        // Expired token — clean up ALL sessions for this user (token reuse detection)
        await prisma.session.deleteMany({
          where: { userId: session.userId },
        });

        logger.warn({ userId: session.userId }, 'Expired refresh token used — all sessions cleared');

        res.status(401).json({
          error: 'Refresh token expired. Please log in again.',
          code: 'UNAUTHORIZED',
        });
        return;
      }

      // Rotate: delete old session, create new one
      await prisma.session.delete({ where: { id: session.id } });
      const tokens = await generateTokens(session.userId, req);

      res.json(tokens);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/logout
router.post(
  '/logout',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await prisma.session.deleteMany({
          where: {
            refreshToken,
            userId: req.userId,
          },
        });
      }

      logger.info({ userId: req.userId }, 'User logged out');

      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me — get current user profile
router.get(
  '/me',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
          isVerified: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              playlists: true,
              likes: true,
              following: true,
              followers: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
        return;
      }

      res.json({ user });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
