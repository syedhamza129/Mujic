import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/auth';
import healthRoutes from './routes/health';
import searchRoutes from './routes/search';
import songRoutes from './routes/songs';
import streamRoutes from './routes/stream';
import playlistRoutes from './routes/playlists';
import likeRoutes from './routes/likes';
import historyRoutes from './routes/history';
import userRoutes from './routes/users';
import uploadRoutes from './routes/uploads';
import genreRoutes from './routes/genres';
import recommendationRoutes from './routes/recommendations';
import exploreRoutes from './routes/explore';
import mediaRoutes from './routes/media';

const app = express();

// ─── Security Middleware ───
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
    credentials: true,
  })
);

// ─── Parsing ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Request Logging ───
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        // Stream tickets are credentials too. Keep URLs useful without logging them.
        const url = req.url?.replace(/([?&](?:ticket|token)=)[^&]+/g, '$1[REDACTED]');
        return { method: req.method, url, remoteAddress: req.remoteAddress };
      },
    },
    autoLogging: {
      ignore: (req) => req.url === '/health',
    },
    customLogLevel(_req, res, err) {
      if (err || (res.statusCode >= 500)) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

// ─── Rate Limiting ───
app.use(globalLimiter);

// ─── Trust proxy (for Railway/Render/reverse proxies) ───
app.set('trust proxy', 1);

// ─── Routes ───
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/songs', songRoutes);

app.use('/api/stream', streamRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/likes', likeRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/genres', genreRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/explore', exploreRoutes);

// ─── 404 Handler ───
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ─── Global Error Handler ───
app.use(errorHandler);

export default app;
