import { create } from 'zustand';
import { playlistService } from '../services/playlistService';

export interface PlaylistItem {
  id: string;
  name: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  songCount: number;
  createdAt: string;
  updatedAt: string;
}

interface PlaylistState {
  playlists: PlaylistItem[];
  loading: boolean;
  error: string | null;

  fetchPlaylists: () => Promise<void>;
  createPlaylist: (name: string, description?: string) => Promise<PlaylistItem>;
  deletePlaylist: (id: string) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loading: false,
  error: null,

  fetchPlaylists: async () => {
    set({ loading: true, error: null });
    try {
      const data = await playlistService.getMyPlaylists(50, 0);
      set({ playlists: data.playlists, loading: false });
    } catch (err) {
      console.error('Failed to fetch playlists:', err);
      set({ loading: false, error: 'Failed to load playlists' });
    }
  },

  createPlaylist: async (name: string, description?: string) => {
    const playlist = await playlistService.createPlaylist(name, description);
    set((s) => ({ playlists: [playlist, ...s.playlists] }));
    return playlist;
  },

  deletePlaylist: async (id: string) => {
    await playlistService.deletePlaylist(id);
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
  },
}));
