import api from './api';
import type { Song } from '../store/usePlayerStore';

interface ExploreSections {
  sections: Record<string, Song[]>;
}

export const exploreService = {
  async getSections(): Promise<ExploreSections> {
    const { data } = await api.get('/explore/sections');
    return data;
  },
};
