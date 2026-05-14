import { NextResponse } from 'next/server';

const CALLBACK_TIMEOUT_MS = 5000;

async function handleStop(): Promise<{ code: number }> {
  // Log play stop event (optional, for future analytics)
  // For now, just acknowledge
  return { code: 0 };
}

export async function POST(request: Request) {
  try {
    const result = await Promise.race([
      handleStop(),
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
