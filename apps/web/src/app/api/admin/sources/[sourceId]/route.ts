import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    await requireAdmin();
    const { sourceId } = await params;
    const body = await request.json();

    const existing = await prisma.playSource.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length === 0) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      data.name = body.name;
    }

    if (body.order !== undefined) {
      if (typeof body.order !== 'number') {
        return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
      }
      data.order = body.order;
    }

    const source = await prisma.playSource.update({
      where: { id: sourceId },
      data,
      include: { qualities: true },
    });

    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    await requireAdmin();
    const { sourceId } = await params;

    const existing = await prisma.playSource.findUnique({
      where: { id: sourceId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.playSource.delete({ where: { id: sourceId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
