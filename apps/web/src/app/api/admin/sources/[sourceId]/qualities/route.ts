import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';

export async function POST(
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

    if (!body.label || typeof body.label !== 'string') {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }

    if (!body.url || typeof body.url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const quality = await prisma.playSourceQuality.create({
      data: {
        label: body.label,
        url: body.url,
        sourceId,
      },
    });

    return NextResponse.json({ quality }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
