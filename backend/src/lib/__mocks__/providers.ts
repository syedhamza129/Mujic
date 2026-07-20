import { vi } from 'vitest';

export const providerMock = {
  getSongDetails: vi.fn(),
  search: vi.fn(),
};

export const providerRegistryMock = {
  getProviderFromSongId: vi.fn().mockReturnValue({
    provider: providerMock,
    sourceId: '123',
  }),
};

vi.mock('../providers/ProviderRegistry', () => ({
  __esModule: true,
  providerRegistry: providerRegistryMock,
}));
