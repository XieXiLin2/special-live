import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow SRS callbacks without auth
  if (pathname.startsWith('/api/srs/')) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/srs/:path*'],
};
