import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';
import { generateStreamKey } from '@/lib/stream-key';
import { StreamRoomVisibility } from '@/types';

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';

    const [rooms, total] = await Promise.all([
      prisma.streamRoom.findMany({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, slug: true, visibility: true,
          streamKey: true, manualMode: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.streamRoom.count({
        where: search ? { name: { contains: search, mode: 'insensitive' } } : undefined,
      }),
    ]);

    return NextResponse.json({ rooms, total, page, pageSize });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const streamKey = generateStreamKey();

    const room = await prisma.streamRoom.create({
      data: {
        name: body.name,
        slug: slug || `room-${Date.now()}`,
        visibility: body.visibility || StreamRoomVisibility.PUBLIC,
        streamKey,
        manualMode: body.manualMode || false,
      },
      select: {
        id: true, name: true, slug: true, visibility: true,
        streamKey: true, manualMode: true, createdAt: true,
      },
    });

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
