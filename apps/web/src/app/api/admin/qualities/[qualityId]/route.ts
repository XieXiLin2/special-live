import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ qualityId: string }> }
) {
  try {
    await requireAdmin();
    const { qualityId } = await params;
    const body = await request.json();

    const existing = await prisma.playSourceQuality.findUnique({
      where: { id: qualityId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.label !== undefined) {
      if (typeof body.label !== 'string' || body.label.length === 0) {
        return NextResponse.json({ error: 'Invalid label' }, { status: 400 });
      }
      data.label = body.label;
    }

    if (body.url !== undefined) {
      if (typeof body.url !== 'string' || body.url.length === 0) {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }
      data.url = body.url;
    }

    const quality = await prisma.playSourceQuality.update({
      where: { id: qualityId },
      data,
    });

    return NextResponse.json({ quality });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ qualityId: string }> }
) {
  try {
    await requireAdmin();
    const { qualityId } = await params;

    const existing = await prisma.playSourceQuality.findUnique({
      where: { id: qualityId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.playSourceQuality.delete({ where: { id: qualityId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
