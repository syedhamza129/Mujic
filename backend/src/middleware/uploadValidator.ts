import multer from 'multer';
import path from 'path';
import os from 'os';
import { Request, Response, NextFunction } from 'express';

// ─── Allowed audio MIME types ───
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',         // MP3
  'audio/mp3',          // MP3 (alternate)
  'audio/wav',          // WAV
  'audio/wave',         // WAV (alternate)
  'audio/x-wav',        // WAV (alternate)
  'audio/flac',         // FLAC
  'audio/x-flac',       // FLAC (alternate)
  'audio/aac',          // AAC
  'audio/ogg',          // OGG
  'audio/mp4',          // M4A
  'audio/x-m4a',        // M4A (alternate)
]);

// ─── Allowed file extensions ───
const ALLOWED_EXTENSIONS = new Set([
  '.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.wma',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// ─── Multer storage config ───
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const tmpDir = path.join(os.tmpdir(), 'mujic-uploads');
    // Ensure temp directory exists
    const fs = require('fs');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    cb(null, tmpDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename to avoid collisions
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

// ─── Multer file filter ───
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype);
  const extOk = ALLOWED_EXTENSIONS.has(ext);

  if (mimeOk || extOk) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype} (${ext}). Allowed: MP3, WAV, FLAC, AAC, OGG, M4A`));
  }
};

// ─── Multer instance ───
export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
}).single('audio');

/**
 * Express middleware wrapper that provides clean error messages for multer errors.
 */
export function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadMiddleware(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE',
        });
        return;
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        res.status(400).json({
          error: 'Only one file can be uploaded at a time',
          code: 'TOO_MANY_FILES',
        });
        return;
      }
      res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
      return;
    }
    if (err) {
      res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
      return;
    }
    next();
  });
}
