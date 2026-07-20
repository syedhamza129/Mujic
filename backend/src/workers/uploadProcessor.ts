import { Queue, Worker, Job } from 'bullmq';
import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { uploadToR2 } from '../lib/r2';
import { logger } from '../lib/logger';
import { env } from '../config/env';

// ─── Job data interface ───
interface UploadJobData {
  songId: string;
  userId: string;
  tempPath: string;
  originalName: string;
  mimeType: string;
}

// ─── Redis connection config for BullMQ ───
const redisUrl = new URL(env.REDIS_URL);

const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port),
  username: redisUrl.username,
  password: redisUrl.password,
  tls: {},
};

// ─── Upload Processing Queue ───
export const uploadQueue = new Queue<UploadJobData>('upload-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  },
});

/**
 * Extract basic metadata from audio file.
 * Uses dynamic import for music-metadata (ESM module).
 */
async function extractMetadata(filePath: string) {
  try {
    // music-metadata is an ESM-only package, use dynamic import
    const mm = await import('music-metadata');
    const metadata = await mm.parseFile(filePath);

    return {
      title: metadata.common.title,
      artist: metadata.common.artist,
      album: metadata.common.album,
      genre: metadata.common.genre?.[0],
      year: metadata.common.year,
      duration: Math.round(metadata.format.duration || 0),
      coverArt: metadata.common.picture?.[0] || null,
    };
  } catch (err) {
    logger.warn({ err, filePath }, 'Failed to extract metadata — using defaults');
    return null;
  }
}

/**
 * Process a single upload job:
 * 1. Read temp file
 * 2. Extract metadata
 * 3. Upload audio to R2/local storage
 * 4. Upload cover art if available
 * 5. Update DB record → READY
 * 6. Clean up temp file
 */
async function processUpload(job: Job<UploadJobData>): Promise<void> {
  const { songId, userId, tempPath, originalName, mimeType } = job.data;

  logger.info({ songId, originalName, jobId: job.id }, 'Processing upload');

  try {
    // 1. Verify temp file exists
    if (!fs.existsSync(tempPath)) {
      throw new Error(`Temp file not found: ${tempPath}`);
    }

    const fileBuffer = fs.readFileSync(tempPath);
    const fileSize = fileBuffer.length;

    await job.updateProgress(10);

    // 2. Extract metadata
    const metadata = await extractMetadata(tempPath);
    const title = metadata?.title || path.parse(originalName).name;
    const artist = metadata?.artist;
    const album = metadata?.album;
    const genre = metadata?.genre;
    const year = metadata?.year;
    const duration = metadata?.duration || 0;

    await job.updateProgress(30);

    // 3. Determine content type and storage key
    const ext = path.extname(originalName).toLowerCase() || '.mp3';
    const audioKey = `uploads/${userId}/${songId}/audio${ext}`;

    // 4. Upload audio to storage
    await uploadToR2(audioKey, fileBuffer, mimeType);
    await job.updateProgress(70);

    // 5. Upload cover art if extracted
    let thumbnailUrl: string | null = null;
    if (metadata?.coverArt) {
      const coverData = metadata.coverArt as any;
      const coverBuffer = Buffer.from(coverData.data);
      const coverMime = coverData.format || 'image/jpeg';
      const coverExt = coverMime.includes('png') ? '.png' : '.jpg';
      const coverKey = `uploads/${userId}/${songId}/cover${coverExt}`;

      await uploadToR2(coverKey, coverBuffer, coverMime);
      thumbnailUrl = coverKey; // Store the key; signed URL is generated at read time
    }

    await job.updateProgress(90);

    // 6. Update DB record
    await prisma.song.update({
      where: { id: songId },
      data: {
        title: metadata?.title || undefined, // Only update if metadata was extracted
        artistName: artist || undefined,
        album: album || undefined,
        genre: genre || undefined,
        year: year || undefined,
        duration,
        fileSize,
        storagePath: audioKey,
        thumbnailUrl,
        status: 'READY',
      },
    });

    // 7. Clean up temp file
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    await job.updateProgress(100);
    logger.info({ songId, duration, fileSize, audioKey }, 'Upload processing complete');
  } catch (err) {
    logger.error({ err, songId, jobId: job.id }, 'Upload processing failed');

    // Mark song as FAILED
    try {
      await prisma.song.update({
        where: { id: songId },
        data: { status: 'FAILED' },
      });
    } catch {
      // Ignore DB update failure
    }

    // Clean up temp file
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }

    throw err; // Re-throw so BullMQ can retry
  }
}

// ─── Worker ───
let worker: Worker<UploadJobData> | null = null;

export function startUploadWorker(): Worker<UploadJobData> {
  if (worker) return worker;

  worker = new Worker<UploadJobData>('upload-processing', processUpload, {
    connection,
    concurrency: 2, // Process 2 uploads at a time
    limiter: {
      max: 5,
      duration: 60000, // Max 5 jobs per minute
    },
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job?.id, songId: job?.data.songId }, 'Upload job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, songId: job?.data.songId, err: err.message, attempts: job?.attemptsMade },
      'Upload job failed'
    );
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Upload worker error');
  });

  logger.info('Upload processing worker started');
  return worker;
}
