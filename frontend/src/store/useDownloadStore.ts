import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { downloadService } from '../services/downloadService';
import type { Song } from './usePlayerStore';

const DOWNLOADS_KEY = 'downloaded_songs';
const PLAY_COUNTS_KEY = 'play_counts';
const AUTO_DOWNLOAD_THRESHOLD = 3;
const PLAY_COUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PlayRecord {
  songId: string;
  timestamp: number;
}

interface DownloadInfo {
  title: string;
  artist: string;
  thumbnail?: string;
  downloadedAt: number;
}

interface DownloadState {
  downloadedIds: Record<string, DownloadInfo>;
  downloadingIds: Record<string, boolean>;
  downloadProgress: Record<string, number>;
  playCounts: PlayRecord[];
  loaded: boolean;

  load: () => Promise<void>;
  markDownloaded: (songId: string, metadata: { title: string; artist: string; thumbnail?: string }) => void;
  markDeleted: (songId: string) => void;
  setDownloading: (songId: string, val: boolean) => void;
  setDownloadProgress: (songId: string, val: number) => void;
  isDownloaded: (songId: string) => boolean;
  isDownloading: (songId: string) => boolean;
  getDownloadedSongs: () => Song[];

  recordPlay: (songId: string) => void;
  shouldAutoDownload: (songId: string) => boolean;
  triggerAutoDownload: (song: Song) => Promise<void>;
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  downloadedIds: {},
  downloadingIds: {},
  downloadProgress: {},
  playCounts: [],
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(DOWNLOADS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const downloadedIds: Record<string, DownloadInfo> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (typeof val === 'boolean') {
          downloadedIds[key] = { title: '', artist: '', downloadedAt: 0 };
        } else {
          downloadedIds[key] = val as DownloadInfo;
        }
      }
      const countsRaw = await AsyncStorage.getItem(PLAY_COUNTS_KEY);
      const playCounts: PlayRecord[] = countsRaw ? JSON.parse(countsRaw) : [];
      set({ downloadedIds, playCounts, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  markDownloaded: (songId, metadata) => {
    const info: DownloadInfo = {
      title: metadata.title,
      artist: metadata.artist,
      thumbnail: metadata.thumbnail,
      downloadedAt: Date.now(),
    };
    const next = { ...get().downloadedIds, [songId]: info };
    const nextProgress = { ...get().downloadProgress };
    delete nextProgress[songId];
    set({
      downloadedIds: next,
      downloadingIds: { ...get().downloadingIds, [songId]: false },
      downloadProgress: nextProgress
    });
    AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(next)).catch(() => {});
  },

  markDeleted: (songId) => {
    const next = { ...get().downloadedIds };
    delete next[songId];
    set({ downloadedIds: next });
    AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(next)).catch(() => {});
  },

  setDownloading: (songId, val) => {
    set({ downloadingIds: { ...get().downloadingIds, [songId]: val } });
    if (!val) {
      const nextProgress = { ...get().downloadProgress };
      delete nextProgress[songId];
      set({ downloadProgress: nextProgress });
    }
  },

  setDownloadProgress: (songId, val) => {
    set({ downloadProgress: { ...get().downloadProgress, [songId]: val } });
  },

  isDownloaded: (songId) => !!get().downloadedIds[songId],
  isDownloading: (songId) => !!get().downloadingIds[songId],

  getDownloadedSongs: () => {
    const entries = Object.entries(get().downloadedIds);
    return entries.map(([id, info]) => ({
      id,
      title: info.title || '',
      artist: info.artist || '',
      thumbnail: info.thumbnail || '',
      duration: 0,
      source: 'youtube' as const,
      streamable: true,
    }));
  },

  recordPlay: (songId) => {
    const now = Date.now();
    const cutoff = now - PLAY_COUNT_WINDOW_MS;
    const recent = get().playCounts.filter((r) => r.timestamp > cutoff);
    recent.push({ songId, timestamp: now });
    set({ playCounts: recent });
    AsyncStorage.setItem(PLAY_COUNTS_KEY, JSON.stringify(recent)).catch(() => {});
  },

  shouldAutoDownload: (songId) => {
    const cutoff = Date.now() - PLAY_COUNT_WINDOW_MS;
    const count = get().playCounts.filter(
      (r) => r.songId === songId && r.timestamp > cutoff
    ).length;
    return count >= AUTO_DOWNLOAD_THRESHOLD && !get().downloadedIds[songId];
  },

  triggerAutoDownload: async (song) => {
    const { isDownloaded, isDownloading, markDownloaded, setDownloading } = get();
    if (isDownloaded(song.id) || isDownloading(song.id)) return;

    setDownloading(song.id, true);
    try {
      await downloadService.downloadSong(song.id);
      markDownloaded(song.id, {
        title: song.title,
        artist: song.artist,
        thumbnail: song.thumbnail,
      });
    } catch {
      setDownloading(song.id, false);
    }
  },
}));
