import { NextResponse } from 'next/server';
import { getSiteConfig, updateSiteConfig } from '@/lib/site-config';
import { requireAdmin } from '@/lib/guards';

export async function GET() {
  try {
    const config = await getSiteConfig();
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    const config = await updateSiteConfig({
      siteTitle: body.siteTitle,
      faviconUrl: body.faviconUrl,
    });

    return NextResponse.json({ config });
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
