import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: roomId } = await params;

    const sources = await prisma.playSource.findMany({
      where: { roomId },
      include: { qualities: true },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: roomId } = await params;
    const body = await request.json();

    const maxOrder = await prisma.playSource.aggregate({
      where: { roomId },
      _max: { order: true },
    });

    const source = await prisma.playSource.create({
      data: {
        name: body.name,
        roomId,
        order: (maxOrder._max.order ?? 0) + 1,
        qualities: {
          create: body.qualities?.map((q: { label: string; url: string }) => ({
            label: q.label,
            url: q.url,
          })) || [],
        },
      },
      include: { qualities: true },
    });

    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
