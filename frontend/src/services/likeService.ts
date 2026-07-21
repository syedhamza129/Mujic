import api from './api';

export const likeService = {
  async likeSong(songId: string) {
    const { data } = await api.post(`/likes/${songId}`);
    return data;
  },

  async unlikeSong(songId: string) {
    const { data } = await api.delete(`/likes/${songId}`);
    return data;
  },

  async getLikedSongs(limit = 20, offset = 0) {
    const { data } = await api.get('/likes', { params: { limit, offset } });
    return data;
  },

  async checkLiked(songId: string): Promise<boolean> {
    const { data } = await api.get(`/likes/check/${songId}`);
    return data.liked;
  },
};
