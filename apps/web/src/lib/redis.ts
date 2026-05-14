import Redis from 'ioredis';

const globalForRedis = global as unknown as { redis: Redis };

export const getRedisClient = (): Redis => {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
  }
  return globalForRedis.redis;
};

export const checkRedisHealth = async (): Promise<{ ok: boolean; error?: string }> => {
  try {
    const client = getRedisClient();
    await client.ping();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};
