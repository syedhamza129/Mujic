import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { providerRegistry } from '../providers/ProviderRegistry';
import { logger } from '../lib/logger';
import { formatSongId } from '../lib/songId';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// ─── Validation Schemas ───

const playSchema = z.object({
  durationMs: z.number().int().min(0).default(0),
  completed: z.boolean().default(false),
});

// ─── Routes ───

// GET /api/songs/trending — get trending songs
router.get(
  '/trending',
  authMiddleware,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(
        parseInt(_req.query.limit as string) || 20,
        50
      );

      const songs = await prisma.song.findMany({
        where: { status: 'READY', source: { not: 'ARCHIVE' } },
        orderBy: { playCount: 'desc' },
        take: limit,
        include: { artist: true },
      });

      res.json({
        songs: songs.map((s) => ({
          id: formatSongId(s.externalId, s.id, s.source),
          title: s.title,
          artist: s.artist?.name || s.artistName,
          album: s.album,
          duration: s.duration,
          thumbnail: toRenderableArtworkUrl(s.thumbnailUrl),
          source: s.source.toLowerCase(),
          playCount: s.playCount,
          streamable: s.status === 'READY',
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);


// GET /api/songs/:id — get song details
router.get(
  '/:id',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      // First check the local database
      const dbSong = await prisma.song.findFirst({
        where: {
          OR: [
            { id: id },
            { externalId: id },
          ],
        },
        include: { artist: true },
      });

      if (dbSong) {
        const likeCount = await prisma.like.count({
          where: { songId: dbSong.id },
        });

        res.json({
          song: {
            id: formatSongId(dbSong.externalId, dbSong.id, dbSong.source),
            title: dbSong.title,
            artist: dbSong.artist?.name || dbSong.artistName,
            album: dbSong.album,
            duration: dbSong.duration,
            thumbnail: toRenderableArtworkUrl(dbSong.thumbnailUrl),
            source: dbSong.source.toLowerCase(),
            playCount: dbSong.playCount,
            likeCount,
            streamable: dbSong.status === 'READY',
          },
        });
        return;
      }

      // If not in DB, try to get from provider
      try {
        const { provider, sourceId } = providerRegistry.getProviderFromSongId(id);
        const details = await provider.getSongDetails(sourceId);

        if (!details) {
          res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
          return;
        }

        res.json({ song: details });
      } catch {
        res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
      }
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/songs/:id/play — record a play event
router.post(
  '/:id/play',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.userId!;

      const parsed = playSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid play data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { durationMs, completed } = parsed.data;

      // Find or identify the song
      let song = await prisma.song.findFirst({
        where: {
          OR: [
            { id: id },
            { externalId: id },
          ],
        },
      });

      // If the song doesn't exist in DB yet (e.g., from YouTube/IA search),
      // try to fetch details from the provider and create a record
      if (!song) {
        try {
          const { provider, sourceId } = providerRegistry.getProviderFromSongId(id);
          const details = await provider.getSongDetails(sourceId);

          if (details) {
            // Map provider type to DB enum
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
          logger.warn({ err, songId: id }, 'Could not fetch song details from provider');
        }
      }

      if (!song) {
        res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
        return;
      }

      // Record the play in listening history and increment play count (transaction)
      await prisma.$transaction([
        prisma.listeningHistory.create({
          data: {
            userId,
            songId: song.id,
            durationMs,
            completed,
          },
        }),
        prisma.song.update({
          where: { id: song.id },
          data: { playCount: { increment: 1 } },
        }),
      ]);

      logger.info({ userId, songId: song.id, completed }, 'Play recorded');

      res.json({ message: 'Play recorded', playCount: song.playCount + 1 });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
