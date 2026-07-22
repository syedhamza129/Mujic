import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import { redis } from '../../lib/redis';
import { logger } from '../../lib/logger';
import type { MusicProvider, NormalizedSong, StreamInfo, SearchOptions } from '../types';

import YTMusic from 'ytmusic-api';
import { Innertube } from 'youtubei.js';

const execFileAsync = promisify(execFile);
const ytmusic = new YTMusic();
let ytmusicInitialized = false;

// youtubei.js (Innertube) singleton — permanent fix for server-IP bot detection
let innertube: Innertube | null = null;
async function getInnertube(): Promise<Innertube> {
  if (!innertube) {
    let cookie: string | undefined = undefined;
    try {
      await fs.access(COOKIE_PATH);
      const content = await fs.readFile(COOKIE_PATH, 'utf-8');
      const cookies: string[] = [];
      const lines = content.split('\n');
      for (const line of lines) {
        let trimmed = line.trim();
        if (!trimmed) continue;
        if (trimmed.startsWith('#HttpOnly_')) {
          trimmed = trimmed.substring('#HttpOnly_'.length);
        } else if (trimmed.startsWith('#')) {
          continue;
        }
        const parts = trimmed.split('\t');
        if (parts.length >= 7) {
          const name = parts[5];
          const value = parts[6];
          cookies.push(`${name}=${value}`);
        }
      }
      if (cookies.length > 0) {
        cookie = cookies.join('; ');
        logger.info({ path: COOKIE_PATH, count: cookies.length, lines: lines.length, sample: cookies.slice(0, 3).join(', ') }, 'Loaded cookies for youtubei.js (Innertube)');
      } else {
        logger.warn({ lines: lines.length, firstLine: lines[0] }, 'No cookies parsed from cookies file');
      }
    } catch {
      // Cookies not found or unreadable, that's fine
    }

    innertube = await Innertube.create({
      retrieve_player: true,
      generate_session_locally: true,
      cookie,
    });
  }
  return innertube;
}

async function ensureYTMusic() {
  if (!ytmusicInitialized) {
    await ytmusic.initialize();
    ytmusicInitialized = true;
  }
}

// In-memory deduplication locks to prevent concurrent yt-dlp calls for the same video
const extractionLocks = new Map<string, Promise<StreamInfo>>();

// YouTube cookies — exported from a logged-in browser and passed via YOUTUBE_COOKIES env var
const COOKIE_PATH = process.env.YOUTUBE_COOKIE_PATH || '/app/cookies.txt';
let hasCookieFile = false;

async function initCookieFile() {
  try {
    const stat = await fs.stat(COOKIE_PATH);
    const content = await fs.readFile(COOKIE_PATH, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
    hasCookieFile = true;
    logger.info({ path: COOKIE_PATH, sizeBytes: stat.size, nonCommentLines: lines.length }, 'YouTube cookies file found — will pass --cookies to yt-dlp');
  } catch {
    hasCookieFile = false;
    logger.warn({ path: COOKIE_PATH }, 'YouTube cookies file not found — yt-dlp may fail on restricted videos');
  }
}
initCookieFile();

// Resolve yt-dlp — supports bare command and python -m yt_dlp on Linux
let ytDlpPath: string | null = null;
async function resolveYtDlpPath(): Promise<string> {
  if (ytDlpPath) return ytDlpPath;

  // Try bare yt-dlp first
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--version'], { timeout: 15000 });
    logger.info({ version: stdout.trim() }, 'yt-dlp resolved (bare)');
    ytDlpPath = 'yt-dlp';
    return ytDlpPath;
  } catch { /* fall through */ }

  // Try python3 -m yt_dlp
  for (const py of ['python3', 'python']) {
    try {
      const { stdout } = await execFileAsync(py, ['-m', 'yt_dlp', '--version'], { timeout: 15000 });
      logger.info({ py, version: stdout.trim() }, 'yt-dlp resolved (python -m)');
      ytDlpPath = py;
      return ytDlpPath;
    } catch { /* fall through */ }
  }

  logger.warn('yt-dlp not found via any method — falling back to bare yt-dlp');
  ytDlpPath = 'yt-dlp';
  return ytDlpPath;
}

export class YouTubeProvider implements MusicProvider {
  readonly type = 'youtube' as const;
  private _available: boolean | null = null;

  async search(options: SearchOptions): Promise<NormalizedSong[]> {
    const limit = options.limit || 10;
    const query = options.query.trim();
    if (!query) return [];

    // Check Redis cache first
    const cacheKey = `yt:search:${query}:${limit}:${options.offset || 0}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ cacheKey }, 'YouTube search cache hit');
        return JSON.parse(cached);
      }
    } catch {
      // Redis unavailable — proceed without cache
    }

    try {
      await ensureYTMusic();
      const songs = await ytmusic.searchSongs(query);
      
      const results = songs.slice(0, limit).map((song: any) => ({
        id: `yt_${song.videoId}`,
        title: song.name || 'Unknown',
        artist: song.artist?.name || 'Unknown Artist',
        album: song.album?.name || undefined,
        duration: song.duration || 0,
        thumbnail: song.thumbnails?.[song.thumbnails.length - 1]?.url || '',
        source: 'youtube' as const,
        streamable: true,
      }));

      // Cache for 30 minutes
      try {
        await redis.setex(cacheKey, 1800, JSON.stringify(results));
      } catch {
        // Redis unavailable — skip caching
      }

      logger.info({ query, count: results.length }, 'YouTube search completed');
      return results;
    } catch (err) {
      logger.error({ err, query }, 'YouTube search failed');
      return [];
    }
  }

  async getStreamInfo(sourceId: string): Promise<StreamInfo> {
    // Strip prefix if present
    const videoId = sourceId.startsWith('yt_') ? sourceId.slice(3) : sourceId;

    // Check Redis cache
    const cacheKey = `yt:stream:${videoId}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ videoId }, 'YouTube stream cache hit');
        return JSON.parse(cached);
      }
    } catch {
      // Redis unavailable
    }

    // Check if recently marked as non-streamable — warn but retry anyway
    try {
      const wasCachedAsFailed = await redis.get(`yt:stream:fail:${videoId}`);
      if (wasCachedAsFailed) {
        logger.warn({ videoId }, 'Video previously failed extraction — retrying');
      }
    } catch {
      // Redis unavailable — proceed to attempt extraction
    }

    // Request deduplication — if another request is already extracting this video, wait for it
    if (extractionLocks.has(videoId)) {
      logger.debug({ videoId }, 'Waiting for existing extraction');
      return extractionLocks.get(videoId)!;
    }

    const promise = this.extractStream(videoId);
    extractionLocks.set(videoId, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      extractionLocks.delete(videoId);
    }
  }

  async getSongDetails(videoId: string): Promise<NormalizedSong | null> {
    const cleanId = videoId.startsWith('yt_') ? videoId.slice(3) : videoId;
    try {
      const ytPath = await resolveYtDlpPath();
      const { cmd, args } = this.ytDlpArgs([
        `https://www.youtube.com/watch?v=${cleanId}`,
        '-j',
        '--no-warnings',
        '--age-limit',
        '99',
        '--socket-timeout',
        '20',
        '--no-check-certificate',
      ]);
      const { stdout } = await execFileAsync(cmd, args, { timeout: 30000 });

      return this.normalize(JSON.parse(stdout));
    } catch (err) {
      const stderr = (err as any)?.stderr?.toString() || '';
      logger.error({ err, videoId, stderr: stderr.slice(0, 500) }, 'YouTube getSongDetails failed');
      return null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (this._available !== null) return this._available;
    try {
      const ytPath = await resolveYtDlpPath();
      await execFileAsync(ytPath, ['--version'], { timeout: 15000 });
      this._available = true;
      return true;
    } catch {
      this._available = false;
      return false;
    }
  }

  private ytDlpArgs(actionArgs: string[], useCookies = true): { cmd: string; args: string[] } {
    const cmd = ytDlpPath || 'yt-dlp';
    const cookieArgs = (useCookies && hasCookieFile) ? ['--cookies', COOKIE_PATH] : [];
    const combinedArgs = [...cookieArgs, ...actionArgs];
    if (cmd === 'python3' || cmd === 'python') {
      return { cmd, args: ['-m', 'yt_dlp', ...combinedArgs] };
    }
    return { cmd, args: combinedArgs };
  }

  private async extractStream(videoId: string): Promise<StreamInfo> {
    // ── Primary: youtubei.js (Innertube) ──────────────────────────────────────
    // Uses YouTube's internal app API — works from server IPs permanently.
    // Try multiple client profiles (IOS, ANDROID, TV_EMBEDDED) in a fallback loop.
    const clientOptions: Array<'IOS' | 'ANDROID' | 'TV_EMBEDDED'> = ['IOS', 'ANDROID', 'TV_EMBEDDED'];
    let lastInnertubeError: any = null;

    for (const clientName of clientOptions) {
      try {
        const yt = await getInnertube();
        // getStreamingData automatically calls decipher() on signature-ciphered streams using YouTube's player.
        const format = await yt.getStreamingData(videoId, {
          type: 'audio',
          client: clientName,
        });

        if (format?.url) {
          const mime = format.mime_type || 'audio/mp4';
          logger.info({ videoId, mime, clientName }, 'youtubei.js (Innertube) stream URL extracted (deciphered)');
          return this.makeStreamInfo(videoId, format.url, mime.split(';')[0]);
        }
        logger.warn({ videoId, clientName }, 'youtubei.js client returned no usable format URL');
      } catch (err: any) {
        lastInnertubeError = err;
        logger.warn({ videoId, clientName, msg: (err?.message || '').slice(0, 300) }, 'youtubei.js client extraction failed');
      }
    }

    // Since youtubei.js failed for all clients, let's log the details from getBasicInfo (with the first client: IOS)
    // for troubleshooting playability/blocking issues on Render.
    if (lastInnertubeError) {
      try {
        const yt = await getInnertube();
        const info = await yt.getBasicInfo(videoId, { client: 'IOS' });
        logger.error({
          videoId,
          status: info.playability_status?.status,
          reason: info.playability_status?.reason,
          err: lastInnertubeError?.message || lastInnertubeError,
        }, 'youtubei.js all clients failed playability diagnostics');
      } catch (diagErr: any) {
        logger.warn({ videoId, msg: diagErr?.message }, 'youtubei.js playability diagnostics failed');
      }
      // Reset innertube singleton so it's recreated fresh next time
      innertube = null;
    }

    // ── Fallback: yt-dlp with various player clients, with and without cookies ──
    const fallbackClients = [
      { client: 'ios',          fmt: 'bestaudio[ext=m4a]/bestaudio/best', useCookies: true  },
      { client: 'android',      fmt: 'bestaudio[ext=m4a]/bestaudio/best', useCookies: true  },
      { client: 'tv_embedded',  fmt: 'bestaudio/best',                    useCookies: true  },
      { client: 'web',          fmt: 'bestaudio[ext=m4a]/bestaudio/best', useCookies: true  },
      { client: 'ios',          fmt: 'bestaudio[ext=m4a]/bestaudio/best', useCookies: false },
      { client: 'android',      fmt: 'bestaudio[ext=m4a]/bestaudio/best', useCookies: false },
      { client: 'web',          fmt: 'bestaudio[ext=m4a]/bestaudio/best', useCookies: false },
      { client: 'tv_embedded',  fmt: 'bestaudio/best',                    useCookies: false },
    ];
    const baseArgs = ['--get-url', '--no-warnings', '--age-limit', '99', '--socket-timeout', '20', '--no-check-certificate'];

    for (const { client, fmt, useCookies } of fallbackClients) {
      try {
        const extraArgs = ['--extractor-args', `youtube:player_client=${client}`, '-f', fmt, ...baseArgs];
        const { cmd, args } = this.ytDlpArgs([`https://www.youtube.com/watch?v=${videoId}`, ...extraArgs], useCookies);
        const { stdout } = await execFileAsync(cmd, args, { timeout: 35000 });
        const streamUrl = stdout.trim().split('\n')[0];
        if (streamUrl && streamUrl.startsWith('http')) {
          logger.info({ videoId, client, cookies: useCookies }, 'yt-dlp fallback stream URL extracted');
          return this.makeStreamInfo(videoId, streamUrl, 'audio/mp4');
        }
      } catch (err: any) {
        logger.warn({ videoId, client, cookies: useCookies, stderr: (err?.stderr?.toString() || '').slice(0, 150) }, 'yt-dlp fallback attempt failed');
      }
    }

    // All extraction methods exhausted
    logger.error({ videoId }, 'All stream extraction methods failed');
    try { await redis.setex(`yt:stream:fail:${videoId}`, 3600, '1'); } catch { }
    throw new Error(`Stream not available for ${videoId}: all extraction methods failed`);
  }

  private makeStreamInfo(videoId: string, url: string, mimeType: string): StreamInfo {
    const streamInfo: StreamInfo = { url, mimeType, isTemporary: true, expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000) };
    try { redis.setex(`yt:stream:${videoId}`, 10800, JSON.stringify(streamInfo)); } catch { }
    logger.info({ videoId }, 'YouTube stream URL extracted');
    return streamInfo;
  }

  private normalize(item: any): NormalizedSong {
    let thumbnail = item.thumbnail || '';
    if (!thumbnail && item.thumbnails?.length) {
      thumbnail = item.thumbnails[item.thumbnails.length - 1]?.url || '';
    }
    return {
      id: `yt_${item.id}`,
      title: item.title || 'Unknown',
      artist: item.uploader || item.channel || item.creator || 'Unknown Artist',
      album: item.album || undefined,
      duration: item.duration || 0,
      thumbnail,
      source: 'youtube',
      streamable: true,
      metadata: {
        viewCount: item.view_count,
        uploadDate: item.upload_date,
      },
    };
  }
}
