import { providerRegistry } from '../providers/ProviderRegistry';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import type { NormalizedSong } from '../providers/types';

interface SearchResult {
  songs: NormalizedSong[];
  total: number;
  offset: number;
  limit: number;
  sources: string[];
}

interface AutocompleteResult {
  suggestions: string[];
}

export async function searchSongs(
  query: string,
  limit: number = 20,
  offset: number = 0,
  source?: 'youtube' | 'archive' | 'upload',
): Promise<SearchResult> {
  const { songs, sources } = await providerRegistry.searchAll({
    query,
    limit,
    offset,
    filters: source ? { source } : undefined,
  });

  return {
    songs,
    total: songs.length, // Approximate — providers don't always return total counts
    offset,
    limit,
    sources,
  };
}

export async function autocomplete(query: string, limit: number = 5): Promise<AutocompleteResult> {
  if (!query || query.length < 2) {
    return { suggestions: [] };
  }

  try {
    // Search local DB songs for autocomplete (case-insensitive LIKE)
    const songs = await prisma.song.findMany({
      where: {
        status: 'READY',
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { artistName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { title: true, artistName: true },
      take: limit * 2, // Get extra so we can deduplicate
      orderBy: { playCount: 'desc' },
    });

    // Build unique suggestions from titles and artist names
    const seen = new Set<string>();
    const suggestions: string[] = [];

    for (const song of songs) {
      const titleLower = song.title.toLowerCase();
      if (titleLower.includes(query.toLowerCase()) && !seen.has(titleLower)) {
        seen.add(titleLower);
        suggestions.push(song.title);
      }

      const artistLower = song.artistName.toLowerCase();
      if (artistLower.includes(query.toLowerCase()) && !seen.has(artistLower)) {
        seen.add(artistLower);
        suggestions.push(song.artistName);
      }

      if (suggestions.length >= limit) break;
    }

    return { suggestions: suggestions.slice(0, limit) };
  } catch (err) {
    logger.error({ err, query }, 'Autocomplete failed');
    return { suggestions: [] };
  }
}
