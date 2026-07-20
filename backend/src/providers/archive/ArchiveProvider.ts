import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import type { MusicProvider, NormalizedSong, StreamInfo, SearchOptions } from '../types';

const IA_BASE = 'https://archive.org';
const IA_SEARCH = `${IA_BASE}/advancedsearch.php`;

export class ArchiveProvider implements MusicProvider {
  readonly type = 'archive' as const;

  async search(options: SearchOptions): Promise<NormalizedSong[]> {
    const query = options.query.trim();
    if (!query) return [];

    const limit = options.limit || 20;
    const offset = options.offset || 0;

    // Check Redis cache
    const cacheKey = `ia:search:${query}:${limit}:${offset}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, 'IA search cache hit');
        return JSON.parse(cached);
      }
    } catch {
      // Redis unavailable
    }

    try {
      const params = new URLSearchParams({
        q: `${query} AND mediatype:audio`,
        fl: 'identifier,title,creator,description,year,downloads',
        sort: 'downloads desc',
        rows: String(limit),
        page: String(Math.floor(offset / limit) + 1),
        output: 'json',
      });

      const response = await fetch(`${IA_SEARCH}?${params}`, {
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`IA search returned ${response.status}`);
      }

      const data: any = await response.json();
      const docs = data?.response?.docs || [];

      const results: NormalizedSong[] = docs.map((doc: any) => this.normalizeItem(doc));

      // Cache for 1 hour
      try {
        await redis.setex(cacheKey, 3600, JSON.stringify(results));
      } catch {
        // Redis unavailable
      }

      logger.info({ query, count: results.length }, 'IA search completed');
      return results;
    } catch (err) {
      logger.error({ err, query }, 'IA search failed');
      return [];
    }
  }

  async getStreamInfo(sourceId: string): Promise<StreamInfo> {
    // sourceId format: "ia_identifier" or "ia_identifier/filename"
    const id = sourceId.startsWith('ia_') ? sourceId.slice(3) : sourceId;

    // For items, we need to get the first audio file
    if (!id.includes('/')) {
      const tracks = await this.getTracksFromItem(id);
      if (tracks.length === 0) throw new Error('No audio files found');
      // Use the first track's stream info
      const trackPath = tracks[0].metadata?.filename as string;
      return {
        url: `${IA_BASE}/download/${id}/${trackPath}`,
        mimeType: 'audio/mpeg',
        isTemporary: false,
      };
    }

    const [identifier, ...filenameParts] = id.split('/');
    const filename = filenameParts.join('/');

    return {
      url: `${IA_BASE}/download/${identifier}/${filename}`,
      mimeType: 'audio/mpeg',
      isTemporary: false, // IA URLs are permanent
    };
  }

  async getSongDetails(sourceId: string): Promise<NormalizedSong | null> {
    const id = sourceId.startsWith('ia_') ? sourceId.slice(3) : sourceId;
    const identifier = id.split('/')[0];

    try {
      const response = await fetch(`${IA_BASE}/metadata/${identifier}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;
      const data: any = await response.json();
      return this.normalizeItem(data.metadata);
    } catch (err) {
      logger.error({ err, identifier }, 'IA getSongDetails failed');
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${IA_BASE}/metadata/`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async getTracksFromItem(identifier: string): Promise<NormalizedSong[]> {
    try {
      const response = await fetch(`${IA_BASE}/metadata/${identifier}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) return [];

      const data: any = await response.json();
      const files = data.files || [];

      const audioFiles = files.filter((f: any) =>
        f.format === 'VBR MP3' || f.format === '128Kbps MP3' ||
        f.name?.endsWith('.mp3') || f.name?.endsWith('.flac') || f.name?.endsWith('.ogg')
      );

      return audioFiles.map((file: any) => ({
        id: `ia_${identifier}/${file.name}`,
        title: file.title || file.name?.replace(/\.[^.]+$/, '') || 'Unknown',
        artist: data.metadata?.creator || 'Unknown Artist',
        duration: this.parseDuration(file.length),
        thumbnail: `${IA_BASE}/services/img/${identifier}`,
        source: 'archive' as const,
        streamable: true,
        metadata: { filename: file.name },
      }));
    } catch {
      return [];
    }
  }

  private normalizeItem(item: any): NormalizedSong {
    return {
      id: `ia_${item.identifier}`,
      title: item.title || 'Unknown',
      artist: item.creator || 'Unknown Artist',
      album: undefined,
      duration: 0, // IA search doesn't return duration
      thumbnail: `${IA_BASE}/services/img/${item.identifier}`,
      source: 'archive',
      streamable: true,
      metadata: {
        year: item.year,
        downloads: item.downloads,
        description: item.description,
      },
    };
  }

  private parseDuration(dur: string | number | undefined): number {
    if (!dur) return 0;
    if (typeof dur === 'number') return Math.round(dur);
    const parts = dur.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return Math.round(parseFloat(dur)) || 0;
  }
}
