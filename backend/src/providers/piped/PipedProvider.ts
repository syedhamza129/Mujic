import { logger } from '../../lib/logger';
import type { MusicProvider, NormalizedSong, StreamInfo, SearchOptions } from '../types';

const FALLBACK_INSTANCES = process.env.PIPED_API_URL
  ? [process.env.PIPED_API_URL]
  : [
      'https://pipedapi.kavin.rocks',
      'https://pipedapi.smnz.de',
      'https://pipedapi.lunar.icu',
      'https://piped-api.ngn.ch',
      'https://pipedapi.pfcd.me',
      'https://pipedapi.tuna.tsinghua.edu.cn',
    ];

let cachedInstances: string[] | null = null;
let lastInstancesFetch = 0;

async function fetchInstances(): Promise<string[]> {
  if (cachedInstances && Date.now() - lastInstancesFetch < 300_000) return cachedInstances;
  try {
    const res = await fetch('https://raw.githubusercontent.com/TeamPiped/Piped-instances/main/instances.json', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    });
    const list = await res.json() as any[];
    const urls = list
      .filter((i: any) => i.api_url && i.health?.api && i.cors === true)
      .sort((a: any, b: any) => (b.health.api || 0) - (a.health.api || 0))
      .map((i: any) => i.api_url.replace(/\/$/, ''));
    if (urls.length > 0) {
      cachedInstances = urls;
      lastInstancesFetch = Date.now();
      logger.info({ count: urls.length, best: urls[0] }, 'Available Piped instances');
      return cachedInstances;
    }
  } catch {
    // fall through to fallback
  }
  cachedInstances = FALLBACK_INSTANCES;
  lastInstancesFetch = Date.now();
  return cachedInstances;
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function pipedFetch(path: string, timeoutMs = 15000): Promise<any> {
  const instances = await fetchInstances();
  let lastErr: Error | undefined;
  for (const baseUrl of instances) {
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} from ${baseUrl}`);
        continue;
      }
      const text = await res.text();
      return JSON.parse(text);
    } catch (err: any) {
      lastErr = err;
      logger.warn({ err: err.message, baseUrl }, 'Piped instance failed');
    }
  }
  throw lastErr || new Error('All Piped instances failed');
}

const YT_THUMB = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

export class PipedProvider implements MusicProvider {
  readonly type = 'youtube';

  async search(options: SearchOptions): Promise<NormalizedSong[]> {
    try {
      const data = await pipedFetch(`/search?q=${encodeURIComponent(options.query)}&filter=videos`);
      const items: any[] = data.items || data || [];
      return items
        .filter((item: any) => item.duration && item.duration > 0)
        .map((item: any) => ({
          id: `yt_${(item.url || '').replace('/watch?v=', '')}`,
          title: item.title || 'Unknown',
          artist: item.uploaderName || item.uploader || 'Unknown',
          duration: item.duration || 0,
          thumbnail: item.thumbnail || YT_THUMB((item.url || '').replace('/watch?v=', '')),
          source: 'youtube' as const,
          streamable: true,
        }));
    } catch (err) {
      logger.warn({ err }, 'Piped search failed');
      return [];
    }
  }

  async getSongDetails(sourceId: string): Promise<NormalizedSong | null> {
    const videoId = sourceId.startsWith('yt_') ? sourceId.slice(3) : sourceId;
    try {
      const data = await pipedFetch(`/streams/${videoId}`);
      return {
        id: `yt_${videoId}`,
        title: data.title || 'Unknown',
        artist: data.uploader || 'Unknown',
        duration: data.duration || 0,
        thumbnail: data.thumbnailUrl || YT_THUMB(videoId),
        source: 'youtube' as const,
        streamable: true,
      };
    } catch (err) {
      logger.warn({ err, videoId }, 'Piped getSongDetails failed');
      return null;
    }
  }

  async getStreamInfo(sourceId: string): Promise<StreamInfo> {
    const videoId = sourceId.startsWith('yt_') ? sourceId.slice(3) : sourceId;
    const data = await pipedFetch(`/streams/${videoId}`);
    const audioStreams: any[] = data.audioStreams || [];
    if (audioStreams.length === 0) {
      // Check dash for audio
      if (data.dash) {
        return { url: data.dash, mimeType: 'application/dash+xml', isTemporary: true };
      }
      throw new Error(`No audio streams for ${videoId}`);
    }
    const best = audioStreams.reduce((a: any, b: any) => ((b.bitrate || 0) > (a.bitrate || 0) ? b : a));
    logger.info({ videoId, bitrate: best.bitrate, format: best.format, url: best.url?.slice(0, 80) }, 'Piped audio stream');
    return {
      url: best.url,
      mimeType: best.mimeType || 'audio/mp4',
      isTemporary: true,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await pipedFetch('/trending?region=US');
      return true;
    } catch {
      return false;
    }
  }
}
