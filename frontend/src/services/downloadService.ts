import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { API_URL } from '../constants/config';
import { useAuthStore } from '../store/useAuthStore';

const DOWNLOADS_DIR = `${RNFS.DocumentDirectoryPath}/downloads`;

export interface DownloadedSong {
  id: string;
  title: string;
  artist: string;
  localPath: string;
  fileSize: number;
  downloadedAt: number;
}

async function ensureDownloadsDir(): Promise<void> {
  const exists = await RNFS.exists(DOWNLOADS_DIR);
  if (!exists) {
    await RNFS.mkdir(DOWNLOADS_DIR);
  }
}

function getFilePath(songId: string): string {
  return `${DOWNLOADS_DIR}/${songId.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
}

export const downloadService = {
  async isDownloaded(songId: string): Promise<boolean> {
    const path = getFilePath(songId);
    return RNFS.exists(path);
  },

  async getDownloadedSong(songId: string): Promise<DownloadedSong | null> {
    const path = getFilePath(songId);
    const exists = await RNFS.exists(path);
    if (!exists) return null;
    const stat = await RNFS.stat(path);
    return {
      id: songId,
      title: '',
      artist: '',
      localPath: `file://${path}`,
      fileSize: stat.size,
      downloadedAt: stat.mtime ? (typeof stat.mtime === 'number' ? stat.mtime : (stat.mtime as any).getTime?.() ?? Date.now()) : Date.now(),
    };
  },

  async downloadSong(
    songId: string,
    onProgress?: (received: number, total: number) => void,
  ): Promise<string> {
    await ensureDownloadsDir();
    const token = await useAuthStore.getState().getValidToken();
    // The backend proxies the download directly (no 302 redirect to CDN),
    // so it is safe to pass auth via Authorization header again.
    const url = `${API_URL}/api/stream/download/${songId}`;
    const destPath = getFilePath(songId);

    // Throttle progress callbacks — RNFS fires them on every network chunk (very fast),
    // which causes hundreds of React state updates per second and freezes the UI.
    let lastPct = -1;
    let lastCallTime = 0;
    const THROTTLE_MS = 300; // at most one update every 300ms

    const throttledProgress = (received: number, total: number) => {
      if (!onProgress || total <= 0) return;
      const now = Date.now();
      const pct = Math.round((received / total) * 100);
      if (pct !== lastPct && now - lastCallTime >= THROTTLE_MS) {
        lastPct = pct;
        lastCallTime = now;
        onProgress(received, total);
      }
    };

    const result = RNFS.downloadFile({
      fromUrl: url,
      toFile: destPath,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      progressInterval: 500,  // native layer: batch progress events every 500ms
      progressDivider: 1,     // report every 1% change
      begin: (res) => {
        onProgress?.(0, res.contentLength || -1);
      },
      progress: (res) => {
        throttledProgress(res.bytesWritten, res.contentLength || -1);
      },
    });

    const response = await result.promise;
    if (response.statusCode !== 200 && response.statusCode !== 206) {
      throw new Error(`Download failed with status ${response.statusCode}`);
    }

    return `file://${destPath}`;
  },

  async deleteSong(songId: string): Promise<void> {
    const path = getFilePath(songId);
    const exists = await RNFS.exists(path);
    if (exists) {
      await RNFS.unlink(path);
    }
  },

  async getStorageUsage(): Promise<{ used: number; free: number }> {
    const downloadDir = await RNFS.stat(DOWNLOADS_DIR).catch(() => null);
    const used = downloadDir?.size || 0;
    const free = (await RNFS.getFSInfo()).freeSpace || 0;
    return { used, free };
  },
};
