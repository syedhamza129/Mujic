import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { providerRegistry } from '../providers/ProviderRegistry';
import { logger } from '../lib/logger';
import { formatSongId } from '../lib/songId';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// ─── Helper: ensure song exists in DB ───

async function ensureSongInDb(songId: string) {
  let song = await prisma.song.findFirst({
    where: { OR: [{ id: songId }, { externalId: songId }] },
  });

  if (!song) {
    try {
      const { provider, sourceId } = providerRegistry.getProviderFromSongId(songId);
      const details = await provider.getSongDetails(sourceId);

      if (details) {
        const sourceMap: Record<string, 'YOUTUBE' | 'ARCHIVE' | 'UPLOAD'> = {
          youtube: 'YOUTUBE',
          archive: 'ARCHIVE',
          upload: 'UPLOAD',
        };

        song = await prisma.song.create({
          data: {
            externalId: details.id,
            title: details.title,
            artistName: details.artist,
            duration: details.duration,
            thumbnailUrl: details.thumbnail || null,
            source: sourceMap[details.source] || 'YOUTUBE',
            status: 'READY',
          },
        });
      }
    } catch (err) {
      logger.warn({ err, songId }, 'Could not fetch song details from provider');
    }
  }

  return song;
}

// ─── Routes ───

// POST /api/likes/:songId — like a song
router.post(
  '/:songId',
  authMiddleware,
  async (req: Request<{ songId: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { songId } = req.params;

      const song = await ensureSongInDb(songId);
      if (!song) {
        res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
        return;
      }

      // Check if already liked
      const existing = await prisma.like.findUnique({
        where: { userId_songId: { userId, songId: song.id } },
      });

      if (existing) {
        res.json({ message: 'Already liked', liked: true });
        return;
      }

      await prisma.like.create({
        data: { userId, songId: song.id },
      });

      logger.info({ userId, songId: song.id }, 'Song liked');
      res.status(201).json({ message: 'Song liked', liked: true });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/likes/:songId — unlike a song
router.delete(
  '/:songId',
  authMiddleware,
  async (req: Request<{ songId: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { songId } = req.params;

      const song = await prisma.song.findFirst({
        where: { OR: [{ id: songId }, { externalId: songId }] },
      });

      if (!song) {
        res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
        return;
      }

      const deleted = await prisma.like.deleteMany({
        where: { userId, songId: song.id },
      });

      if (deleted.count === 0) {
        res.status(404).json({ error: 'Song was not liked', code: 'NOT_FOUND' });
        return;
      }

      logger.info({ userId, songId: song.id }, 'Song unliked');
      res.json({ message: 'Song unliked', liked: false });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/likes — get user's liked songs (paginated, newest first)
router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      const [likes, total] = await Promise.all([
        prisma.like.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
          include: {
            song: {
              include: { artist: true },
            },
          },
        }),
        prisma.like.count({ where: { userId } }),
      ]);

      const songs = likes.map((like) => ({
        id: formatSongId(like.song.externalId, like.song.id, like.song.source),
        title: like.song.title,
        artist: like.song.artist?.name || like.song.artistName,
        album: like.song.album,
        duration: like.song.duration,
        thumbnail: toRenderableArtworkUrl(like.song.thumbnailUrl),
        source: like.song.source.toLowerCase(),
        likedAt: like.createdAt,
      }));

      res.json({ songs, total, offset, limit });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/likes/check/:songId — check if a song is liked
router.get(
  '/check/:songId',
  authMiddleware,
  async (req: Request<{ songId: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const { songId } = req.params;

      const song = await prisma.song.findFirst({
        where: { OR: [{ id: songId }, { externalId: songId }] },
      });

      if (!song) {
        res.json({ liked: false });
        return;
      }

      const like = await prisma.like.findUnique({
        where: { userId_songId: { userId, songId: song.id } },
      });

      res.json({ liked: !!like });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
