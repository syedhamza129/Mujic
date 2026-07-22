import { Router } from 'express';
import { logger } from '../lib/logger';

const router = Router();

router.get('/network', async (_req, res) => {
  const results: Record<string, any> = {};
  const hosts = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.smnz.de',
    'https://google.com',
    'https://raw.githubusercontent.com',
  ];

  for (const url of hosts) {
    const entry: any = { url };
    const start = Date.now();
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000),
      });
      entry.status = r.status;
      entry.ok = r.ok;
      entry.text = (await r.text()).slice(0, 100);
    } catch (err: any) {
      entry.error = err.message;
      entry.cause = err.cause?.message || err.cause?.code || String(err.cause || '');
      entry.code = err.code;
    }
    entry.ms = Date.now() - start;
    results[url] = entry;
  }

  res.json(results);
});

export default router;
