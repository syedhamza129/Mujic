import api from './api';

export const playlistService = {
  async getMyPlaylists(limit = 20, offset = 0) {
    const { data } = await api.get('/playlists', { params: { limit, offset } });
    return data;
  },

  async createPlaylist(name: string, description?: string, isPublic = true) {
    const { data } = await api.post('/playlists', { name, description, isPublic });
    return data.playlist;
  },

  async getPlaylist(id: string) {
    const { data } = await api.get(`/playlists/${id}`);
    return data.playlist;
  },

  async updatePlaylist(id: string, updates: { name?: string; description?: string | null; isPublic?: boolean }) {
    const { data } = await api.put(`/playlists/${id}`, updates);
    return data.playlist;
  },

  async deletePlaylist(id: string) {
    await api.delete(`/playlists/${id}`);
  },

  async addSong(playlistId: string, songId: string, position?: number) {
    const { data } = await api.post(`/playlists/${playlistId}/songs`, { songId, position });
    return data.playlistSong;
  },

  async removeSong(playlistId: string, songId: string) {
    await api.delete(`/playlists/${playlistId}/songs/${songId}`);
  },

  async reorderSongs(playlistId: string, songIds: string[]) {
    await api.put(`/playlists/${playlistId}/reorder`, { songIds });
  },
};
