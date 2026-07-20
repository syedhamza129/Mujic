import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

// GET /api/users/stats — get user stats (total plays, liked songs, playlists)
router.get(
  '/stats',
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId!;

      const [totalPlays, likedSongs, playlistCount] = await Promise.all([
        prisma.listeningHistory.count({ where: { userId } }),
        prisma.like.count({ where: { userId } }),
        prisma.playlist.count({ where: { userId } }),
      ]);

      res.json({ totalPlays, likedSongs, playlistCount });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
