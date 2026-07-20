import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { providerRegistry } from '../providers/ProviderRegistry';
import { formatSongId } from '../lib/songId';
import { logger } from '../lib/logger';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// ─── Validation Schemas ───

const createPlaylistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
});

const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
});

const addSongSchema = z.object({
  songId: z.string().min(1),
  position: z.number().int().min(0).optional(),
});

const reorderSchema = z.object({
  songIds: z.array(z.string().min(1)).min(1),
});

// ─── Helper: ensure song exists in DB (fetch from provider if needed) ───

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

// ─── Helper: verify playlist ownership ───

type OwnedPlaylistResult =
  | { ok: true; playlist: Awaited<ReturnType<typeof prisma.playlist.findUnique>> & {} }
  | { ok: false; error: string; status: number };

async function getOwnedPlaylist(playlistId: string, userId: string): Promise<OwnedPlaylistResult> {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) return { ok: false, error: 'Playlist not found', status: 404 };
  if (playlist.userId !== userId) return { ok: false, error: 'Forbidden', status: 403 };
  return { ok: true, playlist };
}

// ─── Routes ───

// GET /api/playlists — list current user's playlists
router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      const [playlists, total] = await Promise.all([
        prisma.playlist.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          skip: offset,
          take: limit,
          select: {
            id: true,
            name: true,
            description: true,
            coverUrl: true,
            isPublic: true,
            songCount: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.playlist.count({ where: { userId } }),
      ]);

      res.json({ playlists, total, offset, limit });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/playlists — create a new playlist
router.post(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const parsed = createPlaylistSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid playlist data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const playlist = await prisma.playlist.create({
        data: { ...parsed.data, userId },
      });

      logger.info({ userId, playlistId: playlist.id }, 'Playlist created');
      res.status(201).json({ playlist });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/playlists/:id — get playlist with songs
router.get(
  '/:id',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const playlist = await prisma.playlist.findUnique({
        where: { id: req.params.id },
        include: {
          songs: {
            orderBy: { position: 'asc' },
            include: {
              song: {
                include: { artist: true },
              },
            },
          },
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      if (!playlist) {
        res.status(404).json({ error: 'Playlist not found', code: 'NOT_FOUND' });
        return;
      }

      // Private playlists only visible to the owner
      if (!playlist.isPublic && playlist.userId !== req.userId) {
        res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
        return;
      }

      const response = {
        id: playlist.id,
        name: playlist.name,
        description: playlist.description,
        coverUrl: playlist.coverUrl,
        isPublic: playlist.isPublic,
        songCount: playlist.songCount,
        createdAt: playlist.createdAt,
        updatedAt: playlist.updatedAt,
        user: playlist.user,
        songs: playlist.songs.map((ps) => ({
          position: ps.position,
          addedAt: ps.addedAt,
          song: {
            id: formatSongId(ps.song.externalId, ps.song.id, ps.song.source),
            title: ps.song.title,
            artist: ps.song.artist?.name || ps.song.artistName,
            album: ps.song.album,
            duration: ps.song.duration,
            thumbnail: toRenderableArtworkUrl(ps.song.thumbnailUrl),
            source: ps.song.source.toLowerCase(),
          },
        })),
      };

      res.json({ playlist: response });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/playlists/:id — update playlist metadata
router.put(
  '/:id',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const result = await getOwnedPlaylist(req.params.id, userId);

      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          code: result.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        });
        return;
      }

      const parsed = updatePlaylistSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid playlist data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const updated = await prisma.playlist.update({
        where: { id: req.params.id },
        data: parsed.data,
      });

      res.json({ playlist: updated });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/playlists/:id — delete a playlist
router.delete(
  '/:id',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const result = await getOwnedPlaylist(req.params.id, userId);

      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          code: result.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        });
        return;
      }

      await prisma.playlist.delete({ where: { id: req.params.id } });
      logger.info({ userId, playlistId: req.params.id }, 'Playlist deleted');
      res.json({ message: 'Playlist deleted' });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/playlists/:id/songs — add a song to the playlist
router.post(
  '/:id/songs',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const result = await getOwnedPlaylist(req.params.id, userId);

      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          code: result.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        });
        return;
      }

      const parsed = addSongSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { songId, position } = parsed.data;

      // Ensure song exists in DB
      const song = await ensureSongInDb(songId);
      if (!song) {
        res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
        return;
      }

      // Determine position (default: append to end)
      const finalPosition =
        position ??
        ((await prisma.playlistSong.count({ where: { playlistId: req.params.id } })) + 1);

      // Add song and increment count in a transaction
      const [playlistSong] = await prisma.$transaction([
        prisma.playlistSong.create({
          data: {
            playlistId: req.params.id,
            songId: song.id,
            position: finalPosition,
          },
        }),
        prisma.playlist.update({
          where: { id: req.params.id },
          data: { songCount: { increment: 1 } },
        }),
      ]);

      logger.info({ playlistId: req.params.id, songId: song.id }, 'Song added to playlist');
      res.status(201).json({ playlistSong });
    } catch (err: any) {
      // Handle duplicate (song already in playlist)
      if (err.code === 'P2002') {
        res.status(409).json({ error: 'Song already in playlist', code: 'CONFLICT' });
        return;
      }
      next(err);
    }
  }
);

// DELETE /api/playlists/:id/songs/:songId — remove a song from the playlist
router.delete(
  '/:id/songs/:songId',
  authMiddleware,
  async (
    req: Request<{ id: string; songId: string }>,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const userId = req.userId!;
      const result = await getOwnedPlaylist(req.params.id, userId);

      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          code: result.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        });
        return;
      }

      // Find the song in DB by id or externalId
      const song = await prisma.song.findFirst({
        where: { OR: [{ id: req.params.songId }, { externalId: req.params.songId }] },
      });

      if (!song) {
        res.status(404).json({ error: 'Song not found', code: 'NOT_FOUND' });
        return;
      }

      // Delete the playlist-song join row and decrement count
      const deleted = await prisma.playlistSong.deleteMany({
        where: { playlistId: req.params.id, songId: song.id },
      });

      if (deleted.count === 0) {
        res.status(404).json({ error: 'Song not in this playlist', code: 'NOT_FOUND' });
        return;
      }

      await prisma.playlist.update({
        where: { id: req.params.id },
        data: { songCount: { decrement: 1 } },
      });

      logger.info({ playlistId: req.params.id, songId: song.id }, 'Song removed from playlist');
      res.json({ message: 'Song removed from playlist' });
    } catch (err) {
      next(err);
    }
  }
);

// PUT /api/playlists/:id/reorder — reorder songs by providing full songId list
router.put(
  '/:id/reorder',
  authMiddleware,
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;
      const result = await getOwnedPlaylist(req.params.id, userId);

      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          code: result.status === 404 ? 'NOT_FOUND' : 'FORBIDDEN',
        });
        return;
      }

      const parsed = reorderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid reorder data',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { songIds } = parsed.data;

      // Resolve each songId (could be externalId) to internal ID
      const orConditions = songIds.flatMap((sid) => [
        { externalId: sid },
        { id: sid },
      ]);
      const songs = await prisma.song.findMany({
        where: { OR: orConditions },
        select: { id: true, externalId: true },
      });

      const idMap = new Map<string, string>();
      for (const s of songs) {
        idMap.set(s.id, s.id);
        if (s.externalId) idMap.set(s.externalId, s.id);
      }

      // Update positions in a transaction
      const updates = songIds.map((sid, index) => {
        const internalId = idMap.get(sid);
        if (!internalId) return null;
        return prisma.playlistSong.updateMany({
          where: { playlistId: req.params.id, songId: internalId },
          data: { position: index + 1 },
        });
      }).filter(Boolean);

      await prisma.$transaction(updates as any);

      res.json({ message: 'Playlist reordered' });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
