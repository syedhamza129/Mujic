import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { YouTubeProvider } from '../providers/youtube/YouTubeProvider';
import { logger } from '../lib/logger';
import { redis } from '../lib/redis';

const router = Router();
const ytProvider = new YouTubeProvider();

const CURATED_QUERIES: Record<string, { query: string; limit: number }> = {
  bollywood: { query: 'bollywood hits 2026', limit: 15 },
  international: { query: 'top international songs 2026', limit: 15 },
  trending: { query: 'viral songs 2026 trending', limit: 15 },
  pop: { query: 'pop hits 2026', limit: 15 },
  rock: { query: 'best rock songs 2026', limit: 15 },
  hiphop: { query: 'hip hop rap hits 2026', limit: 15 },
  edm: { query: 'electronic dance music 2026', limit: 15 },
  indie: { query: 'indie alternative 2026', limit: 15 },
  classical: { query: 'classical music masterpieces', limit: 15 },
  jazz: { query: 'jazz music best', limit: 15 },
  romantic: { query: 'romantic love songs 2026', limit: 15 },
  workout: { query: 'workout motivation songs', limit: 15 },
  chill: { query: 'chill relaxing music', limit: 15 },
  party: { query: 'party dance songs 2026', limit: 15 },
};

router.get('/sections', authMiddleware, async (_req: Request, res: Response) => {
  try {
    // Use Redis caching so we don't bombard YouTube every time someone opens the home screen
    const cacheKey = 'explore:sections:v3';
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({ sections: JSON.parse(cached) });
      }
    } catch {
      // Redis unavailable
    }

    const results: Record<string, any> = {};
    const entries = Object.entries(CURATED_QUERIES);
    
    // Process in chunks of 3 to avoid triggering YouTube rate limits / 429 Too Many Requests
    const chunkSize = 3;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async ([key, cfg]) => {
          try {
            const songs = await ytProvider.search({
              query: cfg.query,
              limit: cfg.limit,
            });
            results[key] = songs;
          } catch (err) {
            logger.error({ err, key }, 'Explore section failed');
            results[key] = [];
          }
        })
      );
      // Small 1-second delay between chunks for safety
      if (i + chunkSize < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Cache the whole dashboard payload for 12 hours
    try {
      await redis.setex(cacheKey, 12 * 60 * 60, JSON.stringify(results));
    } catch {
      // Redis unavailable
    }

    res.json({ sections: results });
  } catch (err: any) {
    logger.error({ err }, 'Explore sections failed');
    res.status(500).json({ error: 'Failed to load explore sections' });
  }
});

export default router;
