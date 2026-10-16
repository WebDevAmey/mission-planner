import { cookies } from 'next/headers';
import {
  createSession,
  deleteSessionByToken,
  getSession,
  getSessionUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  type ResolvedSession,
  type SessionUser,
} from '@/lib/auth/session';
import { getClientIp } from '@/lib/http/client-ip';

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

/**
 * Issues a fresh session for `userId` and sets the cookie, first revoking any
 * session this browser already holds (switching accounts or re-logging in must
 * not leave the old token valid server-side). Used by login, signup, password
 * reset and password change.
 */
export async function startSession(userId: string, request: Request): Promise<void> {
  const cookieStore = await cookies();
  const previous = cookieStore.get(SESSION_COOKIE)?.value;
  if (previous) await deleteSessionByToken(previous);
  const { token, expiresAt } = await createSession(userId, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: getClientIp(request),
  });
  cookieStore.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}
