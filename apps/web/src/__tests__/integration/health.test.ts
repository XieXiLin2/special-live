import { setTestEnv, parseJson } from '../helpers';
setTestEnv();

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ ping: vi.fn() })),
  checkRedisHealth: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 })
    );
  });

  it('should return healthy status when all services are up', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
    vi.mocked(checkRedisHealth).mockResolvedValue({ ok: true });

    const response = await GET();
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.db).toBe('ok');
    expect(data.redis).toBe('ok');
    expect(data.srs).toBe('ok');
    expect(typeof data.uptime).toBe('number');
  });

  it('should return degraded status when DB is down', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
    vi.mocked(checkRedisHealth).mockResolvedValue({ ok: true });

    const response = await GET();
    const data = await parseJson(response);

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.db).toBe('error');
    expect(data.redis).toBe('ok');
  });

  it('should return degraded status when Redis is down', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ 1: 1 }]);
    vi.mocked(checkRedisHealth).mockResolvedValue({ ok: false, error: 'Connection refused' });

    const response = await GET();
    const data = await parseJson(response);

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.redis).toBe('error');
  });
});
