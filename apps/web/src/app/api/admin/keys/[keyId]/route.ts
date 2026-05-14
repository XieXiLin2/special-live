import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/guards';

export async function PATCH(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    await requireAdmin();
    const { keyId } = await params;
    const body = await request.json();

    const key = await prisma.streamKey.update({
      where: { id: keyId },
      data: { isActive: body.isActive },
      select: { id: true, label: true, isActive: true, createdAt: true },
    });

    return NextResponse.json({ key });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ keyId: string }> }) {
  try {
    await requireAdmin();
    const { keyId } = await params;
    await prisma.streamKey.delete({ where: { id: keyId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
