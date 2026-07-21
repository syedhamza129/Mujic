import api from './api';

export const historyService = {
  async getRecentlyPlayed(limit = 20, offset = 0) {
    const { data } = await api.get('/history', { params: { limit, offset } });
    return data;
  },

  async clearHistory() {
    const { data } = await api.delete('/history');
    return data;
  },
};
