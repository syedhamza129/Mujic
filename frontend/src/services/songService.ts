import api from './api';

export const songService = {
  async getSong(id: string) {
    const { data } = await api.get(`/songs/${id}`);
    return data.song;
  },

  async recordPlay(id: string, durationMs = 0, completed = false) {
    await api.post(`/songs/${id}/play`, { durationMs, completed });
  },

  async getTrending(limit = 20) {
    const { data } = await api.get('/songs/trending', { params: { limit } });
    return data;
  },
};
