import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from './logger';
import fs from 'fs';
import path from 'path';

// ─── Storage Mode ───
// Use R2 when credentials are configured, otherwise fall back to local filesystem
const useR2 = !!(env.CF_ACCOUNT_ID && env.R2_ACCESS_KEY && env.R2_SECRET_KEY);

// Local storage directory (development fallback)
const LOCAL_STORAGE_DIR = path.join(process.cwd(), 'storage');

// ─── R2 Client (Cloudflare R2 via S3-compatible API) ───
const r2Client = useR2
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY,
        secretAccessKey: env.R2_SECRET_KEY,
      },
    })
  : null;

if (useR2) {
  logger.info({ bucket: env.R2_BUCKET }, 'R2 storage configured');
} else {
  logger.warn('R2 credentials not configured — using local filesystem storage');
  // Ensure local storage directory exists
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
}

/**
 * Upload a buffer to storage (R2 or local filesystem).
 */
export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  if (useR2 && r2Client) {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    logger.debug({ key, size: body.length }, 'Uploaded to R2');
  } else {
    // Local filesystem fallback
    const filePath = path.join(LOCAL_STORAGE_DIR, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, body);
    logger.debug({ key, size: body.length, path: filePath }, 'Saved to local storage');
  }
}

/**
 * Generate a signed URL for downloading an object.
 * For local storage, returns a relative path that the stream route can serve.
 */
export async function getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
  if (useR2 && r2Client) {
    const url = await awsGetSignedUrl(
      r2Client,
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
      }),
      { expiresIn }
    );
    return url;
  } else {
    // Local: return a special internal URL that the stream route will handle
    return `__local__:${key}`;
  }
}

/**
 * Get the local file path for a storage key (only for local storage mode).
 */
export function getLocalPath(key: string): string {
  return path.join(LOCAL_STORAGE_DIR, key);
}

/**
 * Delete an object from storage.
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (useR2 && r2Client) {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
      })
    );
    logger.debug({ key }, 'Deleted from R2');
  } else {
    const filePath = path.join(LOCAL_STORAGE_DIR, key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.debug({ key }, 'Deleted from local storage');
    }
  }
}

/**
 * Check if the storage backend is available.
 */
export function isR2Configured(): boolean {
  return useR2;
}
