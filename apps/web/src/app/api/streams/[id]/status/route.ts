import { NextResponse } from 'next/server';
import { getStreamStatus, setStreamStatus } from '@/lib/callback-cache';
import { getSRSStreamStatus } from '@/lib/srs-api';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;

    const cachedStatus = await getStreamStatus(roomId);
    if (cachedStatus) {
      return NextResponse.json({ status: cachedStatus });
    }

    const room = await prisma.streamRoom.findUnique({
      where: { id: roomId },
      select: { streamKey: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const isLive = await getSRSStreamStatus(room.streamKey);
    const status = isLive ? 'live' : 'offline';

    await setStreamStatus(roomId, status, undefined, 5);

    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
