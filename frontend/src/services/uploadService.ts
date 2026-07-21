import api from './api';
import { API_URL } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';
import RNFS from 'react-native-fs';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadResult {
  songId: string;
  status: string;
  message: string;
}

export interface UploadStatus {
  songId: string;
  title: string;
  artist: string;
  status: 'processing' | 'ready' | 'failed';
  duration: number | null;
  fileSize: number | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface UserUpload {
  id: string;
  title: string;
  artistName: string;
  album: string | null;
  status: string;
  duration: number | null;
  fileSize: number | null;
  thumbnailUrl: string | null;
  playCount: number;
  createdAt: string;
}

export const uploadService = {
  async uploadSong(
    fileUri: string,
    fileName: string,
    mimeType: string,
    metadata: { title?: string; artist?: string; album?: string; genre?: string; fileSize?: number },
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    if (onProgress) {
      onProgress({ loaded: 10, total: 100, percentage: 10 });
    }

    try {
      if (onProgress) {
        onProgress({ loaded: 50, total: 100, percentage: 50 });
      }

      const { data } = await api.post('/uploads/metadata', {
        title: metadata.title || fileName.replace(/\.[^.]+$/, ''),
        artist: metadata.artist || 'Unknown Artist',
        album: metadata.album || null,
        genre: metadata.genre || null,
        duration: 0,
        fileSize: metadata.fileSize || 0,
        mimeType: mimeType || 'audio/mpeg',
      });

      if (onProgress) {
        onProgress({ loaded: 100, total: 100, percentage: 100 });
      }

      return {
        songId: data.songId,
        status: data.status,
        message: data.message,
      };
    } catch (err: any) {
      const errMsg = err.response?.data?.error || err.message || 'Failed to register metadata';
      throw new Error(errMsg);
    }
  },

  async getUploadStatus(songId: string): Promise<UploadStatus> {
    const { data } = await api.get(`/uploads/${songId}/status`);
    return data;
  },

  async listUploads(limit = 20, offset = 0): Promise<{ songs: UserUpload[]; total: number }> {
    const { data } = await api.get('/uploads', { params: { limit, offset } });
    return data;
  },

  pollStatus(
    songId: string,
    onUpdate: (status: UploadStatus) => void,
    intervalMs = 2000,
    maxAttempts = 60
  ): { cancel: () => void } {
    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      if (cancelled) return;
      attempts++;

      try {
        const status = await uploadService.getUploadStatus(songId);
        onUpdate(status);

        if (status.status === 'ready' || status.status === 'failed') {
          return;
        }
      } catch {
      }

      if (attempts < maxAttempts && !cancelled) {
        timer = setTimeout(poll, intervalMs);
      }
    };

    poll();
    return { cancel: () => { cancelled = true; clearTimeout(timer); } };
  },
};
