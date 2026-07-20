import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { logger } from '../lib/logger';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const checks: Record<string, any> = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage(),
  };

  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'connected';
  } catch {
    checks.database = 'disconnected';
    checks.status = 'degraded';
  }

  try {
    // Check Redis
    await redis.ping();
    checks.redis = 'connected';
  } catch {
    checks.redis = 'disconnected';
    checks.status = 'degraded';
  }

  const httpStatus = checks.status === 'ok' ? 200 : 503;
  res.status(httpStatus).json(checks);
});

export default router;
