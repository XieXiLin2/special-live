import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StreamRoomVisibility } from '@/types';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';

    const [rooms, total] = await Promise.all([
      prisma.streamRoom.findMany({
        where: {
          visibility: StreamRoomVisibility.PUBLIC,
          ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, name: true, slug: true, visibility: true,
          manualMode: true, createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.streamRoom.count({
        where: {
          visibility: StreamRoomVisibility.PUBLIC,
          ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        },
      }),
    ]);

    return NextResponse.json({ rooms, total, page, pageSize });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
