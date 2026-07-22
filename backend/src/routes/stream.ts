import { spawn } from 'child_process';
import { createReadStream, promises as fs } from 'fs';
import fsSync from 'fs';
import { Router, Request, Response, NextFunction } from 'express';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import { authMiddleware } from '../middleware/auth';
import { streamLimiter } from '../middleware/rateLimiter';
import { providerRegistry } from '../providers/ProviderRegistry';
import { getLocalPath } from '../lib/r2';
import { createStreamTicket, verifyMediaTicket } from '../lib/mediaTickets';
import { logger } from '../lib/logger';
import type { StreamInfo } from '../providers/types';

const router = Router();
const COOKIE_PATH = process.env.YOUTUBE_COOKIE_PATH || '/app/cookies.txt';
const PROXY_UA = 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';
const UPSTREAM_TIMEOUT_MS = 25_000;

function isLocalUrl(url: string): boolean {
  return url.startsWith('__local__:');
}

function localKey(url: string): string {
  return url.slice('__local__:'.length);
}

function parseRange(value: string | undefined, size: number): { start: number; end: number } | null | undefined {
  if (!value?.startsWith('bytes=')) return null;
  const [rawStart, rawEnd] = value.slice(6).split('-', 2);
  const start = rawStart === '' ? Math.max(0, size - Number(rawEnd)) : Number(rawStart);
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) return undefined;
  return { start, end };
}

function responseHeaders(info: StreamInfo, acceptRanges: 'bytes' | 'none', extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': info.mimeType || 'audio/mp4',
    'Accept-Ranges': acceptRanges,
    'Cache-Control': info.isTemporary ? 'private, no-store' : 'private, max-age=3600',
    ...extra,
  };
}

async function sendLocalFile(req: Request, res: Response, info: StreamInfo, headOnly = false, attachment?: string): Promise<void> {
  const filePath = getLocalPath(localKey(info.url));
  const stat = await fs.stat(filePath);
  const range = parseRange(req.headers.range, stat.size);
  if (range === undefined) {
    res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end();
    return;
  }

  const headers = responseHeaders(info, 'bytes', {
    'Content-Length': String(range ? range.end - range.start + 1 : stat.size),
    ...(range ? { 'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}` } : {}),
    ...(attachment ? { 'Content-Disposition': `attachment; filename="${attachment}"` } : {}),
  });
  res.writeHead(range ? 206 : 200, headers);
  if (headOnly) {
    res.end();
    return;
  }
  await pipeline(createReadStream(filePath, range || undefined), res);
}

export function createRequestSignal(req: Request, res: Response): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('Upstream timeout')), UPSTREAM_TIMEOUT_MS);
  const abort = () => controller.abort(new Error('Client disconnected'));
  req.once('aborted', abort);
  res.once('close', () => { if (!res.writableEnded) abort(); });
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      req.off('aborted', abort);
    },
  };
}

async function fetchUpstream(url: string, rangeHeader: string | undefined, method: 'GET' | 'HEAD', signal: AbortSignal): Promise<globalThis.Response> {
  const headers: Record<string, string> = { 'User-Agent': PROXY_UA };
  if (rangeHeader) headers.Range = rangeHeader;
  // YouTube CDN URLs require the same cookies used during URL extraction
  if (url.includes('googlevideo.com') && fsSync.existsSync(COOKIE_PATH)) {
    try {
      const cookieData = await fs.readFile(COOKIE_PATH, 'utf-8');
      const cookies = cookieData.split('\n')
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('\t'))
        .filter((parts) => parts.length >= 7)
        .map((parts) => `${parts[5]}=${parts[6]}`)
        .join('; ');
      if (cookies) headers.Cookie = cookies;
    } catch { /* best-effort */ }
  }
  return fetch(url, { method, headers, signal });
}

async function sendUpstream(req: Request, res: Response, info: StreamInfo, headOnly = false, attachment?: string): Promise<boolean> {
  const context = createRequestSignal(req, res);
  try {
    const upstream = await fetchUpstream(info.url, req.headers.range, headOnly ? 'HEAD' : 'GET', context.signal);
    if (!upstream.ok && upstream.status !== 206) return false;

    const ranged = upstream.status === 206 || !!upstream.headers.get('content-range');
    const headers = responseHeaders(info, ranged || upstream.headers.get('accept-ranges') === 'bytes' ? 'bytes' : 'none', {
      ...(upstream.headers.get('content-range') ? { 'Content-Range': upstream.headers.get('content-range')! } : {}),
      ...(upstream.headers.get('content-length') ? { 'Content-Length': upstream.headers.get('content-length')! } : {}),
      ...(attachment ? { 'Content-Disposition': `attachment; filename="${attachment}"` } : {}),
    });
    res.writeHead(ranged ? 206 : upstream.status, headers);
    if (headOnly || !upstream.body) {
      res.end();
      return true;
    }
    await pipeline(Readable.fromWeb(upstream.body as never), res);
    return true;
  } catch (err) {
    if (!context.signal.aborted) logger.warn({ err }, 'Upstream proxy failed');
    throw err;
  } finally {
    context.cleanup();
  }
}

function ytDlpArgs(videoId: string, playerClient?: string): string[] {
  const args: string[] = [
    `https://www.youtube.com/watch?v=${videoId}`,
    '-f', 'bestaudio/best',
    '-o', '-',
    '--no-warnings',
    '--no-check-certificate',
    '--socket-timeout', '30',
    '--age-limit', '99',
  ];
  if (playerClient) args.push('--extractor-args', `youtube:player_client=${playerClient}`);
  if (playerClient !== 'web' && fsSync.existsSync(COOKIE_PATH)) args.push('--cookies', COOKIE_PATH);
  return args;
}

async function streamViaYtDlp(videoId: string, req: Request, res: Response, attachment?: string): Promise<void> {
  const clients = ['web', 'ios', 'android', 'tv_embedded'];

  for (const client of clients) {
    const process = spawn('yt-dlp', ytDlpArgs(videoId, client));
    const stop = () => { if (!process.killed) process.kill('SIGTERM'); };
    req.once('aborted', stop);
    res.once('close', () => { if (!res.writableEnded) stop(); });

    let stderr = '';
    process.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    const buffer = new PassThrough({ highWaterMark: 65536 });
    process.stdout.pipe(buffer);

    const result = await new Promise<'ok' | 'error'>((resolve) => {
      let headersSent = false;

      const sendError = () => {
        stop();
        if (!res.headersSent) {
          resolve('error');
        } else {
          if (!res.writableEnded) res.end();
          resolve('ok');
        }
      };

      const sendHeaders = () => {
        if (headersSent) return;
        headersSent = true;
        res.writeHead(200, {
          'Content-Type': 'audio/mp4',
          'Accept-Ranges': 'none',
          'Cache-Control': 'private, no-store',
          ...(attachment ? { 'Content-Disposition': `attachment; filename="${attachment}"` } : {}),
        });
      };

      buffer.once('data', () => {
        sendHeaders();
        buffer.pipe(res, { end: false });
        buffer.on('end', () => {
          if (!res.writableEnded) res.end();
          stop();
          resolve('ok');
        });
      });

      process.on('exit', (code) => {
        if (!headersSent) {
          resolve('error');
        }
      });

      const timer = setTimeout(() => {
        if (!headersSent) { process.kill('SIGTERM'); resolve('error'); }
      }, 60_000);

      buffer.once('data', () => clearTimeout(timer));

      process.on('error', () => { if (!headersSent) resolve('error'); });
    });

    if (result === 'ok') return;
    // Client failed, clean up and try next
    stop();
  }

  // All clients failed
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'yt-dlp failed with all player clients', code: 'STREAM_ERROR' }));
  }
}

function streamAuth(req: Request, res: Response, next: NextFunction): void {
  const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : undefined;
  if (ticket) {
    try {
      const payload = verifyMediaTicket(ticket, 'stream');
      if (payload.songId !== req.params.songId) throw new Error('Ticket song mismatch');
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired stream ticket', code: 'UNAUTHORIZED' });
    }
    return;
  }
  authMiddleware(req, res, next);
}

router.post('/:songId/ticket', authMiddleware, (req: Request<{ songId: string }>, res: Response) => {
  res.json({ ticket: createStreamTicket(req.params.songId), expiresInSeconds: 300 });
});

router.get('/download/:songId', authMiddleware, async (req: Request<{ songId: string }>, res: Response) => {
  const { songId } = req.params;
  try {
    const { provider, sourceId } = providerRegistry.getProviderFromSongId(songId);
    const info = await provider.getStreamInfo(sourceId);
    if (isLocalUrl(info.url)) await sendLocalFile(req, res, info, false, `${songId}.mp4`);
    else if (info.url.includes('pipedproxy') || info.url.includes('pipedapi')) res.redirect(info.url);
    else if (!(await sendUpstream(req, res, info, false, `${songId}.mp4`))) res.status(502).json({ error: 'Failed to fetch audio from source', code: 'STREAM_ERROR' });
  } catch (err) {
    logger.error({ err, songId }, 'Download proxy error');
    if (!res.headersSent) res.status(500).json({ error: 'Failed to download audio', code: 'STREAM_ERROR' });
  }
});

router.head('/:songId', streamAuth, async (req: Request<{ songId: string }>, res: Response) => {
  try {
    const { provider, sourceId } = providerRegistry.getProviderFromSongId(req.params.songId);
    const info = await provider.getStreamInfo(sourceId);
    if (isLocalUrl(info.url)) await sendLocalFile(req, res, info, true);
    else if (!(await sendUpstream(req, res, info, true))) res.status(502).end();
  } catch {
    if (!res.headersSent) res.status(500).end();
  }
});

router.get('/:songId', streamAuth, streamLimiter, async (req: Request<{ songId: string }>, res: Response) => {
  const { songId } = req.params;

  try {
    const { provider, sourceId } = providerRegistry.getProviderFromSongId(songId);
    const info = await provider.getStreamInfo(sourceId);

    if (isLocalUrl(info.url)) {
      await sendLocalFile(req, res, info);
      return;
    }

    // Piped CDN URLs are directly accessible from clients — no proxy needed
    if (info.url.includes('pipedproxy') || info.url.includes('pipedapi') || info.url.endsWith('.m3u8')) {
      res.redirect(info.url);
      return;
    }

    if (await sendUpstream(req, res, info)) return;

    if (!res.headersSent) res.status(502).json({ error: 'Failed to fetch audio from source', code: 'STREAM_ERROR' });
  } catch (err: any) {
    logger.error({ err, songId }, 'Stream error');
    if (!res.headersSent) res.status(err.message?.includes('not found') ? 404 : 500).json({ error: 'Failed to stream audio', code: 'STREAM_ERROR' });
  }
});

export default router;
