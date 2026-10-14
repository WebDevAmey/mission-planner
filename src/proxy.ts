import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, getSessionUser } from '@/lib/auth/session';

const AUTH_PAGES = ['/login', '/signup'];
const PROTECTED_PAGES = ['/mission-planner', '/dashboard'];
const PROTECTED_API_PREFIXES = ['/api/flight-deck', '/api/missions'];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = Boolean(await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value));

  if (PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (!authed) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.next();
  }

  if (PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!authed) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (AUTH_PAGES.includes(pathname) && authed) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/mission-planner/:path*',
    '/dashboard/:path*',
    '/api/flight-deck/:path*',
    '/api/missions/:path*',
    '/login',
    '/signup',
  ],
};
