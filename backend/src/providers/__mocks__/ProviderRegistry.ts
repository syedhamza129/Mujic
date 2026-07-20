import { vi } from 'vitest';

export const providerMock = {
  getSongDetails: vi.fn(),
  search: vi.fn(),
};

export const providerRegistry = {
  getProviderFromSongId: vi.fn().mockReturnValue({
    provider: providerMock,
    sourceId: '123',
  }),
};
