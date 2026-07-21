import TrackPlayer from 'react-native-track-player';
import { usePlayerStore, type Song } from '../store/usePlayerStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { downloadService } from './downloadService';
import { useAuthStore } from '../store/useAuthStore';
import { API_URL } from '../constants/config';
import api from './api';
import { recommendationService } from './recommendationService';
import { songService } from './songService';
import { showToast } from '../components/Toast';
import { ensurePlayer } from '../player/trackPlayerSetup';

const WINDOW_SIZE = 4;
const DISABLED_SONGS = new Set<string>();

// ─── URL Resolution ─────────────────────────────────────────────────────────
// Generates a lightweight stream ticket (JWT, no YouTube extraction).
// For downloaded songs, returns the local file path instead.
async function resolveSongUrl(songId: string): Promise<string> {
  const downloaded = await downloadService.isDownloaded(songId);
  if (downloaded) {
    const info = await downloadService.getDownloadedSong(songId);
    if (info) return info.localPath;
  }
  const token = await useAuthStore.getState().getValidToken();
  if (!token) {
    console.error('[resolveSongUrl] no auth token available');
    throw new Error('Not authenticated — please log in');
  }
  try {
    const { data } = await api.post(`/stream/${songId}/ticket`);
    return `${API_URL}/api/stream/${songId}?ticket=${encodeURIComponent(data.ticket)}`;
  } catch (err: any) {
    const status = err?.response?.status || err?.status;
    const body = err?.response?.data;
    console.error('[resolveSongUrl] ticket request failed:', { status, body, message: err?.message || err });
    throw err;
  }
}

function toTrack(song: Song, url: string) {
  return {
    id: song.id,
    url,
    title: song.title,
    artist: song.artist,
    artwork: song.thumbnail || undefined,
    duration: song.duration,
  };
}

// ─── Window Management ──────────────────────────────────────────────────────

async function buildWindow(fromIndex: number): Promise<void> {
  await ensurePlayer();
  const { queue } = usePlayerStore.getState();
  const windowSongs = queue.slice(fromIndex, fromIndex + WINDOW_SIZE);
  if (windowSongs.length === 0) {
    await TrackPlayer.reset();
    return;
  }
  const tracks = await Promise.all(
    windowSongs.map(async (song) => toTrack(song, await resolveSongUrl(song.id)))
  );
  await TrackPlayer.reset();
  await TrackPlayer.add(tracks);
}

async function extendWindow(): Promise<boolean> {
  await ensurePlayer();
  const { queue, queueIndex } = usePlayerStore.getState();
  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  if (activeIndex === undefined) return false;

  // Remove stale tracks (before active index)
  if (activeIndex > 0) {
    const toRemove = Array.from({ length: activeIndex }, (_, i) => i);
    await TrackPlayer.remove(toRemove);
  }

  const remaining = await TrackPlayer.getQueue();
  const currentCount = remaining.length;
  const remainingInZustand = Math.max(0, queue.length - queueIndex - 1);
  const needed = Math.min(WINDOW_SIZE - currentCount, remainingInZustand);
  if (needed <= 0) return remainingInZustand > 0;

  const nextQueueStart = queueIndex + currentCount;
  const upcoming = queue.slice(nextQueueStart, nextQueueStart + needed);
  if (upcoming.length === 0) return false;

  const tracks = await Promise.all(
    upcoming.map(async (song) => toTrack(song, await resolveSongUrl(song.id)))
  );
  await TrackPlayer.add(tracks);
  return true;
}

// ─── Autoplay ───────────────────────────────────────────────────────────────

async function fetchAndPlayRelated(): Promise<void> {
  try {
    const { currentSong } = usePlayerStore.getState();
    if (!currentSong) return;

    const { songs } = await recommendationService.getRecommendations(10);
    if (!songs || songs.length === 0) return;

    const queue: Song[] = songs.map((s) => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      album: s.album,
      duration: s.duration,
      thumbnail: s.thumbnail,
      source: (s.source as Song['source']) || 'youtube',
      streamable: true,
    }));

    usePlayerStore.getState().setQueue(queue);
    await playCollection(queue, 0);
  } catch (err) {
    console.warn('[queueService] fetchAndPlayRelated failed:', err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

async function playCollection(songs: Song[], startIndex: number): Promise<void> {
  const startSong = songs[startIndex] || songs[0];
  if (!startSong) return;

  const store = usePlayerStore.getState();
  store.setQueue(songs);
  store.setQueueIndex(startIndex);
  store.setCurrentSong(startSong);
  store.setIsPlaying(true);

  try {
    await buildWindow(startIndex);
    await TrackPlayer.play();
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[playCollection] buildWindow/play failed:', msg);
    store.setIsPlaying(false);
    showToast(msg, 'error');
    return;
  }

  songService.recordPlay(startSong.id).catch(() => {});
  const dlStore = useDownloadStore.getState();
  dlStore.recordPlay(startSong.id);
  if (dlStore.shouldAutoDownload(startSong.id)) {
    dlStore.triggerAutoDownload(startSong).catch(() => {});
  }

  DISABLED_SONGS.clear();
}

async function skipToNext(): Promise<void> {
  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  if (activeIndex === undefined) return;

  const queue = await TrackPlayer.getQueue();
  if (activeIndex < queue.length - 1) {
    await TrackPlayer.skipToNext();
    return;
  }

  const nextSong = usePlayerStore.getState().playNext();
  if (!nextSong) return;

  const { queueIndex } = usePlayerStore.getState();
  await buildWindow(queueIndex);
  await TrackPlayer.skip(0);
  await TrackPlayer.play();
}

async function skipToPrevious(): Promise<void> {
  const activeIndex = await TrackPlayer.getActiveTrackIndex();
  if (activeIndex === undefined) return;

  if (activeIndex > 0) {
    await TrackPlayer.skipToPrevious();
    return;
  }

  const store = usePlayerStore.getState();
  if (store.queueIndex <= 0) {
    await TrackPlayer.seekTo(0);
    return;
  }

  const prevSong = store.playPrevious();
  if (!prevSong) {
    await TrackPlayer.seekTo(0);
    return;
  }

  const { queueIndex } = usePlayerStore.getState();
  await buildWindow(queueIndex);
  await TrackPlayer.skip(0);
  await TrackPlayer.play();
}

function onActiveTrackChanged(event: { index?: number; track?: { id?: string } }): void {
  if (event.track?.id) {
    const store = usePlayerStore.getState();
    const idx = store.queue.findIndex((s) => s.id === event.track.id);
    if (idx >= 0) {
      store.setCurrentSong(store.queue[idx]);
      store.setQueueIndex(idx);
      store.setIsPlaying(true);
    }
    extendWindow().catch(() => {});
  }
}

async function onQueueEnded(): Promise<void> {
  const { repeatMode } = usePlayerStore.getState();

  if (repeatMode === 'one') {
    await TrackPlayer.seekTo(0);
    await TrackPlayer.play();
    return;
  }

  // Active track finished — advance in Zustand queue
  const nextSong = usePlayerStore.getState().playNext();
  if (nextSong) {
    const { queueIndex } = usePlayerStore.getState();
    await buildWindow(queueIndex);
    await TrackPlayer.skip(0);
    await TrackPlayer.play();
    return;
  }

  await fetchAndPlayRelated();
}

async function onPlaybackError(_event: { code: string; message: string }): Promise<void> {
  const activeTrack = await TrackPlayer.getActiveTrack();
  if (activeTrack?.id) {
    DISABLED_SONGS.add(activeTrack.id);
  }
  await skipToNext();
}

export const queueService = {
  playCollection,
  skipToNext,
  skipToPrevious,
  onActiveTrackChanged,
  onQueueEnded,
  onPlaybackError,
  clearDisabled: () => DISABLED_SONGS.clear(),
};
