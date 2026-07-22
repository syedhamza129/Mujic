import { logger } from '../lib/logger';
import type { MusicProvider, NormalizedSong, SearchOptions, ProviderType } from './types';
import { PipedProvider } from './piped/PipedProvider';
import { ArchiveProvider } from './archive/ArchiveProvider';
import { UploadProvider } from './uploads/UploadProvider';

export class ProviderRegistry {
  private providers: Map<ProviderType, MusicProvider> = new Map();

  constructor() {
    this.register(new PipedProvider());
    this.register(new ArchiveProvider());
    this.register(new UploadProvider());
  }

  register(provider: MusicProvider): void {
    this.providers.set(provider.type, provider);
    logger.info({ type: provider.type }, 'Provider registered');
  }

  getProvider(type: ProviderType): MusicProvider {
    const provider = this.providers.get(type);
    if (!provider) throw new Error(`Provider "${type}" not registered`);
    return provider;
  }

  /**
   * Decode a prefixed song ID (e.g. "yt_xxxx") to its provider
   */
  getProviderFromSongId(songId: string): { provider: MusicProvider; sourceId: string } {
    const prefix = songId.split('_')[0];
    const typeMap: Record<string, ProviderType> = {
      yt: 'youtube',
      ia: 'archive',
      up: 'upload',
    };

    const type = typeMap[prefix];
    if (!type) throw new Error(`Unknown song ID prefix: "${prefix}"`);

    return {
      provider: this.getProvider(type),
      sourceId: songId, // Pass full ID — each provider strips its own prefix
    };
  }

  /**
   * Search across ALL providers in parallel with graceful degradation.
   * Failed providers are silently skipped.
   */
  async searchAll(options: SearchOptions): Promise<{ songs: NormalizedSong[]; sources: string[] }> {
    // If a specific source filter is set, only search that provider
    if (options.filters?.source) {
      const provider = this.providers.get(options.filters.source);
      if (!provider) return { songs: [], sources: [] };
      try {
        const songs = await provider.search(options);
        return { songs, sources: [provider.type] };
      } catch {
        return { songs: [], sources: [] };
      }
    }

    // Call all providers in parallel — no pre-check.
    // Slow/failing providers are silently skipped via Promise.allSettled.
    const providers = Array.from(this.providers.values());
    const perProvider = Math.ceil((options.limit || 20) / providers.length);

    const results = await Promise.allSettled(
      providers.map((provider) => provider.search({ ...options, limit: perProvider }))
    );

    const sources: string[] = [];
    const allSongs: NormalizedSong[][] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        allSongs.push(result.value);
        sources.push(providers[i].type);
      } else if (result.status === 'rejected') {
        logger.warn(
          { provider: providers[i].type, error: result.reason },
          'Provider search failed'
        );
      }
    });

    if (allSongs.length === 0) {
      logger.warn('All providers returned no results');
      return { songs: [], sources: [] };
    }

    // Interleave results round-robin for variety
    const songs = this.interleave(allSongs);

    logger.info({
      query: options.query,
      totalResults: songs.length,
      sources,
    }, 'Aggregated search completed');

    return { songs, sources };
  }

  /**
   * Round-robin interleave from multiple result arrays.
   * [A1,A2,A3], [B1,B2] → [A1,B1,A2,B2,A3]
   */
  private interleave(groups: NormalizedSong[][]): NormalizedSong[] {
    if (groups.length === 0) return [];
    if (groups.length === 1) return groups[0];

    const result: NormalizedSong[] = [];
    const maxLen = Math.max(...groups.map((g) => g.length));

    for (let i = 0; i < maxLen; i++) {
      for (const group of groups) {
        if (i < group.length) {
          result.push(group[i]);
        }
      }
    }

    return result;
  }
}

// Singleton instance
export const providerRegistry = new ProviderRegistry();
