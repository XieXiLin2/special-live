import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: roomId } = await params;

    const room = await prisma.streamRoom.findUnique({
      where: { id: roomId },
      select: { manualMode: true, visibility: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (!room.manualMode) {
      return NextResponse.json({ sources: [] });
    }

    const sources = await prisma.playSource.findMany({
      where: { roomId },
      include: { qualities: true },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
