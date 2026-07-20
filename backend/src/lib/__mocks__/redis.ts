import { vi } from 'vitest';

export const redis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),
};

export const connectRedis = vi.fn().mockResolvedValue(undefined);
