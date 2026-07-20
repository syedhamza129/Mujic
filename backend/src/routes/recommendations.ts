import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../lib/logger';
import { formatSongId } from '../lib/songId';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// Helper to get most frequent items
function getMostFrequent(arr: string[], topN: number): string[] {
  const counts = new Map<string, number>();
  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map((entry) => entry[0]);
}

router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const limitQuery = parseInt(req.query.limit as string);
    const limit = Math.min(isNaN(limitQuery) ? 20 : limitQuery, 50);

    // 1. Get user's listening patterns (genres + artists from last 50 plays)
    const recentHistory = await prisma.listeningHistory.findMany({
      where: { userId },
      orderBy: { playedAt: 'desc' },
      take: 50,
      include: {
        song: {
          select: { genre: true, artistName: true, id: true },
        },
      },
    });

    const playedSongIds = new Set(recentHistory.map((h) => h.songId));
    const userGenres: string[] = [];
    const userArtists: string[] = [];

    for (const h of recentHistory) {
      if (h.song.genre) userGenres.push(h.song.genre);
      if (h.song.artistName) userArtists.push(h.song.artistName);
    }

    // 1b. Get user's liked songs
    const likedSongs = await prisma.like.findMany({
      where: { userId },
      include: {
        song: {
          select: { genre: true, artistName: true, id: true },
        },
      },
    });

    for (const l of likedSongs) {
      playedSongIds.add(l.songId);
      if (l.song.genre) userGenres.push(l.song.genre);
      if (l.song.artistName) userArtists.push(l.song.artistName);
    }

    const topGenres = getMostFrequent(userGenres, 5);
    const topArtists = getMostFrequent(userArtists, 5);

    let songs: any[] = [];

    if (topGenres.length > 0 || topArtists.length > 0) {
      // 2. Find songs matching user taste that they haven't played
      songs = await prisma.song.findMany({
        where: {
          status: 'READY',
          id: { notIn: Array.from(playedSongIds) },
          OR: [
            ...(topGenres.length > 0
              ? [{ genre: { in: topGenres } }]
              : []),
            ...(topArtists.length > 0
              ? [{ artistName: { in: topArtists } }]
              : []),
          ],
        },
        take: limit,
        orderBy: { playCount: 'desc' },
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
      });

      // 3. Collaborative filtering (liked by similar users)
      if (songs.length < limit) {
        const likedSongIds = Array.from(
          new Set(likedSongs.map((l) => l.songId))
        );
        if (likedSongIds.length > 0) {
          const similarUsers = await prisma.like.findMany({
            where: {
              songId: { in: likedSongIds },
              userId: { not: userId },
            },
            select: { userId: true },
            distinct: ['userId'],
            take: 10,
          });

          const similarUserIds = similarUsers.map((u) => u.userId);

          if (similarUserIds.length > 0) {
            const collabSongs = await prisma.like.findMany({
              where: {
                userId: { in: similarUserIds },
                songId: { notIn: Array.from(playedSongIds) },
              },
              include: {
                song: {
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
                },
              },
              take: limit - songs.length,
            });

            songs.push(...collabSongs.map((c) => c.song));
            
            // Deduplicate
            songs = Array.from(new Set(songs.map((s) => s.id))).map((id) =>
              songs.find((s) => s.id === id)
            );
          }
        }
      }
    }

    // 4. Fallback to trending if still empty
    if (songs.length < limit) {
      const trending = await prisma.song.findMany({
        where: {
          status: 'READY',
          id: { notIn: Array.from(playedSongIds) },
        },
        orderBy: { playCount: 'desc' },
        take: limit - songs.length,
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
      });

      songs.push(...trending);
      
      // Deduplicate again
      songs = Array.from(new Set(songs.map((s) => s.id))).map((id) =>
        songs.find((s) => s.id === id)
      );
    }

    // Normalize output
    const normalized = songs.map((s) => {
      return {
        id: formatSongId(s.externalId, s.id, s.source),
        title: s.title,
        artist: s.artistName,
        album: s.album,
        duration: s.duration,
        thumbnail: toRenderableArtworkUrl(s.thumbnailUrl),
        source: s.source.toLowerCase(),
        playCount: s.playCount,
        streamable: true,
      };
    });

    res.json({ songs: normalized, total: normalized.length });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get recommendations');
    res.status(500).json({ error: 'Failed to get recommendations', code: 'SERVER_ERROR' });
  }
});

export default router;
