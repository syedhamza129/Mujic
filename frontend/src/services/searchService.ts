import api, { searchApi } from './api';

export const searchService = {
  async search(query: string, limit = 20, offset = 0, source?: string) {
    // Use searchApi with 35s timeout — yt-dlp YouTube search can take ~15s
    const { data } = await searchApi.get('/search', {
      params: { q: query, limit, offset, source },
    });
    return data;
  },

  async autocomplete(query: string, limit = 5) {
    const { data } = await api.get('/search/autocomplete', {
      params: { q: query, limit },
    });
    return data;
  },
};
