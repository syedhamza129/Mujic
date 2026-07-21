import TrackPlayer, { Event } from 'react-native-track-player';
import { usePlayerStore } from '../store/usePlayerStore';
import { queueService } from '../services/queueService';

export async function playbackService() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, (e) => {
    TrackPlayer.seekTo(e.position).catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    queueService.skipToNext().catch(() => {});
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    queueService.skipToPrevious().catch(() => {});
  });

  // ─── Primary synchronization point ────────────────────────────────────────
  // This is the single authoritative source for currentSong and queueIndex.
  TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, (e) => {
    queueService.onActiveTrackChanged(e);
  });

  // ─── Queue end: repeat-mode logic, autoplay, recommendations ─────────────
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => {
    queueService.onQueueEnded().catch(() => {});
  });

  // ─── Playback error: skip to next track ──────────────────────────────────
  TrackPlayer.addEventListener(Event.PlaybackError, (e) => {
    queueService.onPlaybackError(e).catch(() => {});
  });

  // ─── Playback state: sync isPlaying and playbackState ────────────────────
  TrackPlayer.addEventListener(Event.PlaybackState, (state) => {
    const store = usePlayerStore.getState();
    if ('state' in state) {
      const s = state.state;
      store.setPlaybackState(s);
      if (s === 'playing' && !store.isPlaying) {
        store.setIsPlaying(true);
      } else if ((s === 'paused' || s === 'stopped') && store.isPlaying) {
        store.setIsPlaying(false);
      }
    }
  });
}
