import api from './api';

export interface RecommendedSong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  duration: number;
  thumbnail: string;
  source: string;
  playCount: number;
}

export const recommendationService = {
  async getRecommendations(limit = 20): Promise<{ songs: RecommendedSong[]; total: number }> {
    const { data } = await api.get('/recommendations', { params: { limit } });
    return data;
  },
};
