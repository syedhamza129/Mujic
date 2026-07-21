import api from './api';

export interface Genre {
  name: string;
  songCount: number;
}

export interface GenreSong {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  thumbnail: string;
  source: string;
  playCount: number;
}

export const genreService = {
  async getGenres(): Promise<Genre[]> {
    const { data } = await api.get('/genres');
    return data.genres;
  },

  async getGenreSongs(genre: string, limit = 20, offset = 0): Promise<{ songs: GenreSong[]; total: number }> {
    const { data } = await api.get(`/genres/${encodeURIComponent(genre)}/songs`, {
      params: { limit, offset },
    });
    return data;
  },
};
