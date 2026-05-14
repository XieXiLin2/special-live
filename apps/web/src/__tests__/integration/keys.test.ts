import { setTestEnv, createMockStreamKey, createRequest, parseJson } from '../helpers';
setTestEnv();

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as keysGet, POST as keysPost } from '@/app/api/admin/rooms/[id]/keys/route';
import { POST as srsPublishPost } from '@/app/api/srs/publish/route';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    streamKey: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/guards', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ id: 'admin-id', role: 'ADMIN' }),
}));

vi.mock('@/lib/crypto', () => ({
  generateKey: vi.fn().mockReturnValue({ plain: 'plain-key-123', hash: 'hashed-key-456' }),
}));

vi.mock('@/lib/callback-cache', () => ({
  cachePublishToken: vi.fn().mockResolvedValue(undefined),
  getRoomByStreamKey: vi.fn().mockResolvedValue('room-test-id'),
}));

vi.mock('@/lib/redis', () => ({
  getRedisClient: vi.fn(() => ({ get: vi.fn(), setex: vi.fn() })),
  checkRedisHealth: vi.fn().mockResolvedValue({ ok: true }),
}));

describe('Stream Keys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a key for a room', async () => {
    vi.mocked(prisma.streamKey.create).mockResolvedValue({
      id: 'new-key-id',
      keyHash: 'hashed-key-456',
      label: 'Test Key',
      isActive: true,
      roomId: 'room-test-id',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      expiresAt: null,
    } as any);

    const request = createRequest('http://localhost:3000/api/admin/rooms/room-test-id/keys', {
      method: 'POST',
      body: { label: 'Test Key' },
    });

    const response = await keysPost(request, { params: Promise.resolve({ id: 'room-test-id' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(201);
    expect(data.key.plain).toBe('plain-key-123');
    expect(data.key.label).toBe('Test Key');
    expect(data.key.isActive).toBe(true);
  });

  it('should list keys for a room', async () => {
    const mockKeys = [
      createMockStreamKey({ id: 'key-1', label: 'Key One' }),
      createMockStreamKey({ id: 'key-2', label: 'Key Two' }),
    ];
    vi.mocked(prisma.streamKey.findMany).mockResolvedValue(mockKeys);

    const request = new Request('http://localhost:3000/api/admin/rooms/room-test-id/keys');
    const response = await keysGet(request, { params: Promise.resolve({ id: 'room-test-id' }) });
    const data = await parseJson(response);

    expect(response.status).toBe(200);
    expect(Array.isArray(data.keys)).toBe(true);
    expect(data.keys).toHaveLength(2);
  });
});

describe('SRS Publish Callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject invalid key in SRS callback', async () => {
    const request = createRequest('http://localhost:3000/api/srs/publish', {
      method: 'POST',
      body: {
        action: 'on_publish',
        stream: 'test-stream',
        param: '?token=invalid-token',
      },
    });

    const response = await srsPublishPost(request);
    const data = await parseJson(response);

    expect(data.code).toBe(1);
  });

  it('should reject missing token in SRS callback', async () => {
    const request = createRequest('http://localhost:3000/api/srs/publish', {
      method: 'POST',
      body: {
        action: 'on_publish',
        stream: 'test-stream',
        param: '',
      },
    });

    const response = await srsPublishPost(request);
    const data = await parseJson(response);

    expect(data.code).toBe(1);
  });

  it('should reject missing stream in SRS callback', async () => {
    const request = createRequest('http://localhost:3000/api/srs/publish', {
      method: 'POST',
      body: {
        action: 'on_publish',
        stream: '',
        param: '?token=some-token',
      },
    });

    const response = await srsPublishPost(request);
    const data = await parseJson(response);

    expect(data.code).toBe(1);
  });

  it('should accept valid token in SRS callback', async () => {
    const mockRedis = { get: vi.fn().mockResolvedValue('room-test-id'), setex: vi.fn() };
    vi.mocked(getRedisClient).mockReturnValue(mockRedis as any);

    const request = createRequest('http://localhost:3000/api/srs/publish', {
      method: 'POST',
      headers: { 'X-Callback-Secret': 'test-srs-callback-secret' },
      body: {
        action: 'on_publish',
        stream: 'test-stream-key-123',
        param: '?token=valid-token-abc',
      },
    });

    const response = await srsPublishPost(request);
    const data = await parseJson(response);

    expect(data.code).toBe(0);
  });

  it('should reject wrong callback secret', async () => {
    const request = createRequest('http://localhost:3000/api/srs/publish?secret=wrong-secret', {
      method: 'POST',
      body: {
        action: 'on_publish',
        stream: 'test-stream',
        param: '?token=some-token',
      },
    });

    const response = await srsPublishPost(request);
    const data = await parseJson(response);

    expect(data.code).toBe(1);
  });
});
