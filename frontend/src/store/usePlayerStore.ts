import { create } from 'zustand';

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  thumbnail: string;
  source: 'youtube' | 'archive' | 'upload';
  streamable: boolean;
}

type RepeatMode = 'off' | 'all' | 'one';

interface PlayerState {
  currentSong: Song | null;
  queue: Song[];
  queueIndex: number;
  isPlaying: boolean;
  isMinimized: boolean;
  playbackState: string | null;
  shuffle: boolean;
  repeatMode: RepeatMode;

  setCurrentSong: (song: Song | null) => void;
  setQueue: (songs: Song[]) => void;
  setQueueIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackState: (state: string | null) => void;
  toggleMinimized: () => void;
  addToQueue: (song: Song) => void;
  addNextToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playNext: () => Song | null;
  playPrevious: () => Song | null;
  playPlaylist: (songs: Song[], startIndex?: number) => Song | null;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

function getShuffledIndex(currentIndex: number, queueLength: number): number {
  if (queueLength <= 1) return currentIndex;
  let next: number;
  do {
    next = Math.floor(Math.random() * queueLength);
  } while (next === currentIndex);
  return next;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentSong: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  isMinimized: true,
  playbackState: null,
  shuffle: false,
  repeatMode: 'off',

  setCurrentSong: (song) => set({ currentSong: song }),
  setQueue: (songs) => set({ queue: songs, queueIndex: -1 }),
  setQueueIndex: (index) => set({ queueIndex: index }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackState: (state) => set({ playbackState: state }),
  toggleMinimized: () => set((s) => ({ isMinimized: !s.isMinimized })),
  addToQueue: (song) => set((s) => ({ queue: [...s.queue, song] })),
  addNextToQueue: (song) => set((s) => {
    const newQueue = [...s.queue];
    const insertAt = s.queueIndex + 1;
    newQueue.splice(insertAt, 0, song);
    return { queue: newQueue };
  }),
  removeFromQueue: (index) =>
    set((s) => ({
      queue: s.queue.filter((_, i) => i !== index),
      queueIndex: index < s.queueIndex ? s.queueIndex - 1 : s.queueIndex,
    })),
  clearQueue: () => set({ queue: [], queueIndex: -1 }),

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === 'off' ? 'all'
        : s.repeatMode === 'all' ? 'one'
        : 'off',
    })),

  playNext: () => {
    const { queue, queueIndex, shuffle, repeatMode } = get();

    if (repeatMode === 'one' && queue[queueIndex]) {
      return queue[queueIndex];
    }

    let nextIndex: number;
    if (shuffle) {
      nextIndex = getShuffledIndex(queueIndex, queue.length);
    } else {
      nextIndex = queueIndex + 1;
    }

    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return null;
      }
    }

    const nextSong = queue[nextIndex];
    if (!nextSong) return null;
    set({ queueIndex: nextIndex });
    return nextSong;
  },

  playPrevious: () => {
    const { queue, queueIndex } = get();
    const prevIndex = queueIndex - 1;
    if (prevIndex < 0) return null;
    const prevSong = queue[prevIndex];
    set({ queueIndex: prevIndex });
    return prevSong;
  },

  playPlaylist: (songs, startIndex = 0) => {
    if (songs.length === 0) return null;
    const song = songs[startIndex] || songs[0];
    set({
      queue: songs,
      queueIndex: startIndex,
    });
    return song;
  },
}));
