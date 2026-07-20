import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { searchSongs, autocomplete } from '../services/searchService';

const router = Router();

// ─── Validation Schemas ───

const searchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
  source: z.enum(['youtube', 'archive', 'upload']).optional(),
});

const autocompleteQuerySchema = z.object({
  q: z.string().min(1, 'Query is required').max(100),
  limit: z.coerce.number().min(1).max(10).default(5),
});

// ─── Routes ───

// GET /api/search?q=...&limit=20&offset=0&source=youtube
router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = searchQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid search parameters',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { q, limit, offset, source } = parsed.data;
      const result = await searchSongs(q, limit, offset, source);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/search/autocomplete?q=...&limit=5
router.get(
  '/autocomplete',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = autocompleteQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          error: 'Invalid autocomplete parameters',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        });
        return;
      }

      const { q, limit } = parsed.data;
      const result = await autocomplete(q, limit);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
