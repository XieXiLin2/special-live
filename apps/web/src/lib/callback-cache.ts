import { getRedisClient } from './redis';
import { cacheKeys } from './cache-keys';
import { prisma } from './prisma';

const redis = getRedisClient();

export async function cacheRoomStreamKey(roomId: string, streamKey: string): Promise<void> {
  await redis.set(cacheKeys.roomByStreamKey(streamKey), roomId);
}

export async function getRoomByStreamKey(streamKey: string): Promise<string | null> {
  return redis.get(cacheKeys.roomByStreamKey(streamKey));
}

export async function cacheActiveKey(roomId: string, keyHash: string): Promise<void> {
  await redis.sadd(cacheKeys.activeKeys(roomId), keyHash);
}

export async function removeActiveKey(roomId: string, keyHash: string): Promise<void> {
  await redis.srem(cacheKeys.activeKeys(roomId), keyHash);
}

export async function isKeyActive(roomId: string, keyHash: string): Promise<boolean> {
  const result = await redis.sismember(cacheKeys.activeKeys(roomId), keyHash);
  return result === 1;
}

export async function setStreamStatus(
  roomId: string,
  status: 'live' | 'offline',
  metadata?: Record<string, string>,
  ttlSeconds?: number
): Promise<void> {
  const key = cacheKeys.streamStatus(roomId);
  if (metadata) {
    await redis.hset(key, { status, ...metadata });
  } else {
    await redis.set(key, status);
  }
  await redis.expire(key, ttlSeconds ?? 300);
}

export async function getStreamStatus(roomId: string): Promise<string | null> {
  const key = cacheKeys.streamStatus(roomId);
  const type = await redis.type(key);
  if (type === 'hash') {
    const data = await redis.hgetall(key);
    return data.status || null;
  }
  return redis.get(key);
}

export async function invalidateRoom(roomId: string): Promise<void> {
  const pattern = `stream:*:${roomId}`;
  // Use scan to find and delete keys (limited scope, safe)
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}

export async function cachePublishToken(token: string, roomId: string, ttlSeconds: number = 3600): Promise<void> {
  await redis.setex(cacheKeys.publishToken(token), ttlSeconds, roomId);
}

export async function cacheRoomVisibility(
  roomId: string,
  visibility: string
): Promise<void> {
  await redis.set(cacheKeys.roomVisibility(roomId), visibility);
}

export async function getRoomVisibility(
  roomId: string
): Promise<string | null> {
  return redis.get(cacheKeys.roomVisibility(roomId));
}

export async function cacheAccessToken(
  token: string,
  roomId: string,
  ttlSeconds: number = 3600
): Promise<void> {
  await redis.setex(cacheKeys.accessToken(token), ttlSeconds, roomId);
}

export async function getRoomByAccessToken(
  token: string
): Promise<string | null> {
  return redis.get(cacheKeys.accessToken(token));
}

export async function populateRoomCache(roomId: string): Promise<void> {
  const room = await prisma.streamRoom.findUnique({
    where: { id: roomId },
    include: { streamKeys: true },
  });

  if (!room) return;

  await cacheRoomStreamKey(roomId, room.streamKey);
  await cacheRoomVisibility(roomId, room.visibility);

  const activeKeys = room.streamKeys.filter((k: { isActive: boolean }) => k.isActive);
  if (activeKeys.length > 0) {
    await redis.sadd(
      cacheKeys.activeKeys(roomId),
      ...activeKeys.map((k: { keyHash: string }) => k.keyHash)
    );
  }
}
