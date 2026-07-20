import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  // Allow token via ?token= query param for streaming URLs (TrackPlayer cannot set headers)
  let rawToken: string | undefined;
  if (header && header.startsWith('Bearer ')) {
    rawToken = header.split(' ')[1];
  } else if (typeof req.query.token === 'string' && req.query.token) {
    rawToken = req.query.token;
  }

  if (!rawToken) {
    res.status(401).json({
      error: 'Missing authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = rawToken;

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as { userId: string };
    req.userId = payload.userId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Access token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    logger.warn({ err }, 'Invalid JWT token');
    res.status(401).json({
      error: 'Invalid token',
      code: 'UNAUTHORIZED',
    });
  }
}
