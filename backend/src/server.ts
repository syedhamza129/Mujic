import app from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { connectRedis, redis } from './lib/redis';
import { startUploadWorker } from './workers/uploadProcessor';

async function main() {
  logger.info('Starting Mujic API server...');

  // Connect to Redis
  try {
    await connectRedis();
    logger.info('✅ Redis connected');
  } catch (err) {
    logger.warn({ err }, '⚠️  Redis connection failed — continuing without cache');
  }

  // Verify database connection
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected');
  } catch (err) {
    logger.error({ err }, '❌ PostgreSQL connection failed');
    process.exit(1);
  }

  // Start Express server
  const server = app.listen(env.PORT, () => {
    logger.info(`🎵 Mujic API listening on port ${env.PORT}`);
    logger.info(`   Environment: ${env.NODE_ENV}`);
    logger.info(`   Health check: http://localhost:${env.PORT}/health`);
  });

  // Start BullMQ upload processing worker
  try {
    startUploadWorker();
    logger.info('✅ Upload processing worker started');
  } catch (err) {
    logger.warn({ err }, '⚠️  Upload worker failed to start — uploads will not be processed');
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await prisma.$disconnect();
        logger.info('PostgreSQL disconnected');
      } catch (e) {
        logger.error(e, 'Error disconnecting PostgreSQL');
      }

      try {
        await redis.quit();
        logger.info('Redis disconnected');
      } catch (e) {
        logger.error(e, 'Error disconnecting Redis');
      }

      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
