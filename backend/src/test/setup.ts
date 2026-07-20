import { vi, beforeEach } from 'vitest';
import { mockReset } from 'vitest-mock-extended';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { providerRegistry } from '../providers/ProviderRegistry';

// Global mocks
vi.mock('../lib/prisma');
vi.mock('../lib/redis');
vi.mock('../providers/ProviderRegistry');

// Bypass rate limiters in tests
vi.mock('../middleware/rateLimiter', () => ({
  globalLimiter: (req: any, res: any, next: any) => next(),
  authLimiter: (req: any, res: any, next: any) => next(),
  streamLimiter: (req: any, res: any, next: any) => next(),
}));

beforeEach(() => {
  mockReset(prisma as any);
  vi.clearAllMocks();
});
