import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith('/api/flight-deck')) {
    if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.next();
  }

  if (pathname.startsWith('/mission-planner')) {
    if (!authed) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname === '/login' && authed) {
    return NextResponse.redirect(new URL('/mission-planner', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/mission-planner/:path*', '/api/flight-deck/:path*', '/login'],
};
