import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { formatSongId } from '../lib/songId';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// GET /api/history — get recently played songs (paginated, deduplicated)
router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      // Fetch recent history entries with song details
      const history = await prisma.listeningHistory.findMany({
        where: { userId },
        orderBy: { playedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          song: {
            include: { artist: true },
          },
        },
        // Deduplicate: use distinct on songId to get unique songs
        distinct: ['songId'],
      });

      const total = await prisma.listeningHistory.groupBy({
        by: ['songId'],
        where: { userId },
      }).then((groups) => groups.length);

      const songs = history.map((entry) => ({
        id: formatSongId(entry.song.externalId, entry.song.id, entry.song.source),
        title: entry.song.title,
        artist: entry.song.artist?.name || entry.song.artistName,
        album: entry.song.album,
        duration: entry.song.duration,
        thumbnail: toRenderableArtworkUrl(entry.song.thumbnailUrl),
        source: entry.song.source.toLowerCase(),
        playedAt: entry.playedAt,
        completed: entry.completed,
      }));

      res.json({ songs, total, offset, limit });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/history — clear all listening history for the current user
router.delete(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      await prisma.listeningHistory.deleteMany({ where: { userId } });
      res.json({ message: 'History cleared' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
