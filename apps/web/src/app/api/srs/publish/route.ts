import { NextResponse } from 'next/server';
import { getRoomByStreamKey } from '@/lib/callback-cache';
import { getEnv } from '@/lib/env';
import { getRedisClient } from '@/lib/redis';
import { cacheKeys } from '@/lib/cache-keys';

const CALLBACK_TIMEOUT_MS = 5000;

interface PublishBody {
  action: string;
  stream: string;
  param?: string;
  ip?: string;
  stream_url?: string;
  stream_id?: string;
}

async function handlePublish(request: Request, body: PublishBody): Promise<{ code: number }> {
  const secretHeader = request.headers.get('X-Callback-Secret');
  const url = new URL(request.url);
  const secretQuery = url.searchParams.get('secret');
  const expectedSecret = getEnv().SRS_CALLBACK_SECRET;

  if (secretHeader !== expectedSecret && secretQuery !== expectedSecret) {
    return { code: 1 };
  }

  const streamKey = body.stream;
  if (!streamKey) {
    return { code: 1 };
  }

  const param = body.param || '';
  const tokenMatch = param.match(/[?&]token=([^&]+)/);
  const token = tokenMatch ? decodeURIComponent(tokenMatch[1]) : '';

  if (!token) {
    return { code: 1 };
  }

  // Must use Redis only — no DB queries or bcrypt to stay under 100ms
  const roomId = await getRoomByStreamKey(streamKey);
  if (!roomId) {
    return { code: 1 };
  }

  const redis = getRedisClient();
  const cachedRoom = await redis.get(cacheKeys.publishToken(token));
  if (cachedRoom === roomId) {
    return { code: 0 };
  }

  return { code: 1 };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await Promise.race([
      handlePublish(request, body),
      new Promise<{ code: number }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), CALLBACK_TIMEOUT_MS)
      ),
    ]);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ code: 1 });
  }
}
