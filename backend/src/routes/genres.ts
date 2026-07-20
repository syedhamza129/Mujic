import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { formatSongId } from '../lib/songId';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// ─── GET /api/genres — List all genres with song counts ───
router.get('/', async (_req: Request, res: Response) => {
  try {
    const genres = await prisma.song.groupBy({
      by: ['genre'],
      where: {
        genre: { not: null },
        status: 'READY',
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Also include songs without explicit genre from provider results
    const results = genres
      .filter((g) => g.genre && g.genre.trim() !== '')
      .map((g) => ({
        name: g.genre!,
        songCount: g._count.id,
      }));

    res.json({ genres: results });
  } catch (err: any) {
    logger.error({ err }, 'Failed to list genres');
    res.status(500).json({ error: 'Failed to list genres', code: 'SERVER_ERROR' });
  }
});

// ─── GET /api/genres/:genre/songs — Songs in a genre ───
router.get('/:genre/songs', async (req: Request<{ genre: string }>, res: Response) => {
  try {
    const { genre } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const [songs, total] = await Promise.all([
      prisma.song.findMany({
        where: {
          genre: { equals: genre, mode: 'insensitive' },
          status: 'READY',
        },
        orderBy: { playCount: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          artistName: true,
          album: true,
          genre: true,
          duration: true,
          playCount: true,
          thumbnailUrl: true,
          source: true,
          externalId: true,
        },
      }),
      prisma.song.count({
        where: {
          genre: { equals: genre, mode: 'insensitive' },
          status: 'READY',
        },
      }),
    ]);

    // Normalize song IDs with source prefix
    const normalized = songs.map((s) => {
      return {
        id: formatSongId(s.externalId, s.id, s.source),
        title: s.title,
        artist: s.artistName || 'Unknown Artist',
        album: s.album,
        duration: s.duration || 0,
        thumbnail: toRenderableArtworkUrl(s.thumbnailUrl) || '',
        source: s.source?.toLowerCase() || 'upload',
        playCount: s.playCount,
      };
    });

    res.json({ songs: normalized, total, limit, offset });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get genre songs');
    res.status(500).json({ error: 'Failed to get genre songs', code: 'SERVER_ERROR' });
  }
});

export default router;
