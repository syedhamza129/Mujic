import api from './api';

export const userService = {
  async getStats() {
    const { data } = await api.get('/users/stats');
    return data as { totalPlays: number; likedSongs: number; playlistCount: number };
  },
};
