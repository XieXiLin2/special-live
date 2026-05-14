import { NextResponse } from 'next/server';
import { setStreamStatus, getRoomByStreamKey } from '@/lib/callback-cache';

const CALLBACK_TIMEOUT_MS = 5000;

interface UnpublishBody {
  action: string;
  stream: string;
}

async function handleUnpublish(body: UnpublishBody): Promise<{ code: number }> {
  const streamKey = body.stream;

  if (streamKey) {
    const roomId = await getRoomByStreamKey(streamKey);
    if (roomId) {
      await setStreamStatus(roomId, 'offline');
    }
  }

  return { code: 0 };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await Promise.race([
      handleUnpublish(body),
      new Promise<{ code: number }>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), CALLBACK_TIMEOUT_MS)
      ),
    ]);

    return NextResponse.json(result);
  } catch {
    // Graceful degradation — always return success
    return NextResponse.json({ code: 0 });
  }
}
