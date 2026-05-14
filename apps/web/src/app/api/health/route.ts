import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkRedisHealth } from '@/lib/redis';

const HEALTH_TIMEOUT_MS = 2000;

async function checkDB(): Promise<{ ok: boolean; error?: string }> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), HEALTH_TIMEOUT_MS)
      ),
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'DB error' };
  }
}

async function checkSRS(): Promise<{ ok: boolean; error?: string }> {
  try {
    await Promise.race([
      fetch(`${process.env.SRS_API_URL || 'http://localhost:1985'}/api/v1/versions`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${process.env.SRS_HTTP_API_AUTH_USERNAME || 'admin'}:${process.env.SRS_HTTP_API_AUTH_PASSWORD || 'admin'}`).toString('base64')}`,
        },
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), HEALTH_TIMEOUT_MS)
      ),
    ]);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'SRS error' };
  }
}

export async function GET() {
  const [db, redis, srs] = await Promise.all([
    checkDB(),
    checkRedisHealth(),
    checkSRS(),
  ]);

  const allOk = db.ok && redis.ok && srs.ok;

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      db: db.ok ? 'ok' : 'error',
      redis: redis.ok ? 'ok' : 'error',
      srs: srs.ok ? 'ok' : 'error',
      uptime: process.uptime(),
    },
    { status: allOk ? 200 : 503 }
  );
}
