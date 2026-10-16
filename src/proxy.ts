import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, getSessionUser } from '@/lib/auth/session';
import { safeNextPath } from '@/lib/http/safe-redirect';

const AUTH_PAGES = ['/login', '/signup'];
const PROTECTED_PAGES = ['/mission-planner', '/missions', '/dashboard', '/settings'];
const PROTECTED_API_PREFIXES = ['/api/flight-deck', '/api/missions', '/api/geo', '/api/account'];

/**
 * Coarse gate only. Every route handler re-checks the session itself
 * (authorize() / getCurrentSession()), so for API calls this just refuses
 * requests with no session cookie at all and skips a database round trip;
 * page navigations get the full session check so signed-out users are
 * redirected to /login.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (PROTECTED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!token) return Response.json({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.next();
  }

  const authed = Boolean(await getSessionUser(token));

  if (PROTECTED_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (!authed) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (AUTH_PAGES.includes(pathname)) {
    // Router prefetches (RSC) must not be redirected: the browser would follow the
    // 307 without RSC headers and log a 404. The real navigation still redirects.
    if (request.headers.get('next-router-prefetch') || request.headers.get('rsc')) return NextResponse.next();
    const next = request.nextUrl.searchParams.get('next');
    const safeNext = safeNextPath(next);
    if (authed) return NextResponse.redirect(new URL(safeNext ?? '/dashboard', request.url));
    // Open-redirect guard: the sign-in page navigates to ?next= after login, so
    // drop anything that isn't a same-site path before the page ever sees it.
    if (next !== null && safeNext === null) {
      const clean = request.nextUrl.clone();
      clean.searchParams.delete('next');
      return NextResponse.redirect(clean);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/mission-planner/:path*',
    '/missions/:path*',
    '/dashboard/:path*',
    '/settings/:path*',
    '/api/flight-deck/:path*',
    '/api/missions/:path*',
    '/api/geo/:path*',
    '/api/account/:path*',
    '/login',
    '/signup',
  ],
};
