import { cookies } from 'next/headers';
import { getSession, getSessionUser, SESSION_COOKIE, type ResolvedSession, type SessionUser } from '@/lib/auth/session';

/** Reads and verifies the session cookie for the current request. Every
 * mission/account route handler calls this itself rather than trusting
 * anything the client claims — proxy.ts blocks page navigation for signed-out
 * users, but route handlers are a separate trust boundary (see the Next.js
 * guidance to not rely on proxy alone for authorization). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

/** Like getCurrentUser, but also returns the session id (Settings › Sessions marks "this device"). */
export async function getCurrentSession(): Promise<ResolvedSession | null> {
  const cookieStore = await cookies();
  return getSession(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}
