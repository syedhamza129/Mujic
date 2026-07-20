import { Router, Request, Response } from 'express';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth';
import { handleUpload } from '../middleware/uploadValidator';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { uploadQueue } from '../workers/uploadProcessor';
import { toRenderableArtworkUrl } from '../lib/mediaTickets';

const router = Router();

// ─── POST /api/uploads/metadata — Upload metadata only (for local playback) ───
router.post(
  '/metadata',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const { title, artist, album, genre, duration, fileSize, mimeType } = req.body;

      if (!title) {
        res.status(400).json({ error: 'Title is required', code: 'TITLE_REQUIRED' });
        return;
      }

      // Create song record immediately as READY
      const song = await prisma.song.create({
        data: {
          title,
          artistName: artist || 'Unknown Artist',
          album: album || null,
          genre: genre || null,
          duration: duration || 0,
          fileSize: fileSize || null,
          mimeType: mimeType || 'audio/mpeg',
          source: 'UPLOAD',
          status: 'READY',
          uploadedById: userId,
        },
      });

      logger.info(
        { songId: song.id, userId, title },
        'Metadata-only upload created successfully'
      );

      res.status(201).json({
        songId: song.id,
        status: 'ready',
        message: 'Song metadata registered successfully.',
      });
    } catch (err: any) {
      logger.error({ err }, 'Metadata registration failed');
      res.status(500).json({ error: 'Failed to register metadata', code: 'UPLOAD_ERROR' });
    }
  }
);

// ─── POST /api/uploads — Upload an audio file ───
router.post(
  '/',
  authMiddleware,
  handleUpload,
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'No audio file provided', code: 'NO_FILE' });
        return;
      }

      const userId = (req as any).userId as string;
      const title = (req.body.title as string) || file.originalname.replace(/\.[^.]+$/, '');
      const artist = (req.body.artist as string) || 'Unknown Artist';
      const album = (req.body.album as string) || undefined;
      const genre = (req.body.genre as string) || undefined;

      // Create song record with PROCESSING status
      const song = await prisma.song.create({
        data: {
          title,
          artistName: artist,
          album,
          genre,
          source: 'UPLOAD',
          status: 'PROCESSING',
          mimeType: file.mimetype,
          fileSize: file.size,
          uploadedById: userId,
        },
      });

      // Queue the processing job
      await uploadQueue.add(
        'process-upload',
        {
          songId: song.id,
          userId,
          tempPath: file.path,
          originalName: file.originalname,
          mimeType: file.mimetype,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );

      logger.info(
        { songId: song.id, userId, filename: file.originalname, size: file.size },
        'Upload accepted, processing queued'
      );

      res.status(202).json({
        songId: song.id,
        status: 'processing',
        message: 'Upload accepted. Processing will begin shortly.',
      });
    } catch (err: any) {
      logger.error({ err }, 'Upload failed');

      // Clean up temp file on error
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({ error: 'Upload failed', code: 'UPLOAD_ERROR' });
    }
  }
);

// ─── GET /api/uploads/:songId/status — Check processing status ───
router.get(
  '/:songId/status',
  authMiddleware,
  async (req: Request<{ songId: string }>, res: Response) => {
    try {
      const { songId } = req.params;
      const userId = (req as any).userId as string;

      const song = await prisma.song.findFirst({
        where: {
          id: songId,
          uploadedById: userId,
          source: 'UPLOAD',
        },
        select: {
          id: true,
          title: true,
          artistName: true,
          status: true,
          duration: true,
          fileSize: true,
          thumbnailUrl: true,
          createdAt: true,
        },
      });

      if (!song) {
        res.status(404).json({ error: 'Upload not found', code: 'NOT_FOUND' });
        return;
      }

      res.json({
        songId: song.id,
        title: song.title,
        artist: song.artistName,
        status: song.status.toLowerCase(),
        duration: song.duration,
        fileSize: song.fileSize,
        thumbnailUrl: toRenderableArtworkUrl(song.thumbnailUrl),
        createdAt: song.createdAt,
      });
    } catch (err: any) {
      logger.error({ err }, 'Failed to get upload status');
      res.status(500).json({ error: 'Failed to get upload status', code: 'SERVER_ERROR' });
    }
  }
);

// ─── GET /api/uploads — List user's uploads ───
router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).userId as string;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const offset = parseInt(req.query.offset as string) || 0;

      const songs = await prisma.song.findMany({
        where: {
          uploadedById: userId,
          source: 'UPLOAD',
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          title: true,
          artistName: true,
          album: true,
          status: true,
          duration: true,
          fileSize: true,
          thumbnailUrl: true,
          playCount: true,
          createdAt: true,
        },
      });

      const total = await prisma.song.count({
        where: { uploadedById: userId, source: 'UPLOAD' },
      });

      res.json({
        songs: songs.map((s) => ({
          ...s,
          thumbnailUrl: toRenderableArtworkUrl(s.thumbnailUrl),
          status: s.status.toLowerCase(),
        })),
        total,
        limit,
        offset,
      });
    } catch (err: any) {
      logger.error({ err }, 'Failed to list uploads');
      res.status(500).json({ error: 'Failed to list uploads', code: 'SERVER_ERROR' });
    }
  }
);

export default router;
