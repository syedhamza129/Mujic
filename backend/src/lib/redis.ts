import Redis from 'ioredis';
import { env } from '../config/env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
  } catch (err) {
    // ioredis may already be connecting/connected
    if ((err as Error).message?.includes('already')) return;
    throw err;
  }
}
