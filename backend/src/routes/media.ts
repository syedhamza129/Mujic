import { Router, Request, Response } from 'express';
import { createReadStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { getLocalPath, getSignedUrl, isR2Configured } from '../lib/r2';
import { verifyMediaTicket } from '../lib/mediaTickets';
import { logger } from '../lib/logger';

const router = Router();

router.get('/artwork/:ticket', async (req: Request<{ ticket: string }>, res: Response) => {
  try {
    const { storageKey } = verifyMediaTicket(req.params.ticket, 'artwork');
    if (!storageKey) throw new Error('Missing artwork key');

    if (!isR2Configured()) {
      const path = getLocalPath(storageKey);
      const stat = await fs.stat(path);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Content-Type', storageKey.endsWith('.png') ? 'image/png' : 'image/jpeg');
      await pipeline(createReadStream(path), res);
      return;
    }

    const upstream = await fetch(await getSignedUrl(storageKey, 60), {
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok || !upstream.body) {
      res.status(502).end();
      return;
    }
    const type = upstream.headers.get('content-type');
    const length = upstream.headers.get('content-length');
    if (type) res.setHeader('Content-Type', type);
    if (length) res.setHeader('Content-Length', length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    await pipeline(Readable.fromWeb(upstream.body as never), res);
  } catch (err) {
    logger.warn({ err }, 'Artwork request rejected or failed');
    if (!res.headersSent) res.status(404).end();
  }
});

export default router;
