import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

// Global rate limiter: 100 requests per minute per IP
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

// Auth endpoints: 5 attempts per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'development' ? 100 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' },
});

// Stream endpoints: 60 requests per minute per IP
export const streamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Stream rate limit exceeded', code: 'RATE_LIMITED' },
});
