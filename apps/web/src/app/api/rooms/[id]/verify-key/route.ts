import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { cacheKeys } from '@/lib/cache-keys';
import bcrypt from 'bcrypt';

const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 60;

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  return 'unknown';
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { key } = body;

    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    const room = await prisma.streamRoom.findUnique({
      where: { slug: id },
      select: {
        id: true,
        name: true,
        slug: true,
        visibility: true,
        manualMode: true,
      },
    });

    if (!room) {
      return NextResponse.json({ valid: false }, { status: 404 });
    }

    if (room.visibility === 'PUBLIC') {
      return NextResponse.json({
        valid: true,
        room: {
          id: room.id,
          name: room.name,
          slug: room.slug,
          visibility: room.visibility,
          manualMode: room.manualMode,
        },
      });
    }

    const ip = getClientIp(request);
    const rateKey = cacheKeys.rateLimit(ip, 'verify-key');
    const redis = getRedisClient();

    const current = await redis.incr(rateKey);
    if (current === 1) {
      await redis.expire(rateKey, WINDOW_SECONDS);
    }

    if (current > MAX_ATTEMPTS) {
      return NextResponse.json({ valid: false }, { status: 429 });
    }

    const activeKeys = await prisma.streamKey.findMany({
      where: { roomId: room.id, isActive: true },
      select: { keyHash: true },
    });

    let matched = false;
    for (const record of activeKeys) {
      if (await bcrypt.compare(key, record.keyHash)) {
        matched = true;
        break;
      }
    }

    if (matched) {
      return NextResponse.json({
        valid: true,
        room: {
          id: room.id,
          name: room.name,
          slug: room.slug,
          visibility: room.visibility,
          manualMode: room.manualMode,
        },
      });
    }

    return NextResponse.json({ valid: false });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
