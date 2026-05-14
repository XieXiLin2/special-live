import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const room = await prisma.streamRoom.findUnique({
      where: { slug: id },
      select: {
        id: true,
        name: true,
        slug: true,
        visibility: true,
        manualMode: true,
        createdAt: true,
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
