import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';
import { generateKey } from '@/lib/crypto';
import { cachePublishToken } from '@/lib/callback-cache';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: roomId } = await params;
    const keys = await prisma.streamKey.findMany({
      where: { roomId },
      select: { id: true, label: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json({ keys });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id: roomId } = await params;
    const body = await request.json();
    const { plain, hash } = generateKey();

    const key = await prisma.streamKey.create({
      data: {
        keyHash: hash,
        label: body.label || 'Stream Key',
        isActive: true,
        roomId,
      },
      select: { id: true, label: true, isActive: true, createdAt: true },
    });

    await cachePublishToken(plain, roomId);

    return NextResponse.json({ key: { ...key, plain } }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
