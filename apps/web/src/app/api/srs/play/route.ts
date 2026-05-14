import { NextResponse } from 'next/server';
import { getRoomByStreamKey, getRoomVisibility, getRoomByAccessToken } from '@/lib/callback-cache';
import { getEnv } from '@/lib/env';
import { StreamRoomVisibility } from '@/types';

const CALLBACK_TIMEOUT_MS = 5000;

interface PlayBody {
  action: string;
  stream: string;
  param?: string;
  ip?: string;
  stream_url?: string;
}

async function handlePlay(request: Request, body: PlayBody): Promise<{ code: number }> {
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

  // Lookup room by stream key (Redis O(1))
  const roomId = await getRoomByStreamKey(streamKey);
  if (!roomId) {
    return { code: 1 };
  }

  // Check room visibility from cache
  const visibility = await getRoomVisibility(roomId);

  if (visibility === StreamRoomVisibility.PUBLIC) {
    return { code: 0 };
  }

  // If not cached or private, check access key
  const param = body.param || '';
  const keyMatch = param.match(/[?&]key=([^&]+)/);
  const accessKey = keyMatch ? decodeURIComponent(keyMatch[1]) : '';

  if (!accessKey) {
    return { code: 1 };
  }

  // Check cached access token (Redis O(1))
  const cachedRoom = await getRoomByAccessToken(accessKey);
  if (cachedRoom === roomId) {
    return { code: 0 };
  }

  return { code: 1 };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await Promise.race([
      handlePlay(request, body),
      new Promise<{ code: number }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), CALLBACK_TIMEOUT_MS)
      ),
    ]);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ code: 1 });
  }
}
