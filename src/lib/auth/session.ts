import { db } from '@/prisma/db';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { toIsoString } from '@/lib/db/serialize';

export const SESSION_COOKIE = 'mps_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** Issues a new DB-backed session row and returns the raw token to set as a cookie.
 * Only the token's hash is stored, so a leaked database row can't be replayed. */
export async function createSession(
  userId: string,
  meta?: { userAgent?: string | null; ipAddress?: string | null }
): Promise<CreatedSession> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.orm.public.Session.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt: toIsoString(expiresAt),
    userAgent: meta?.userAgent ?? null,
    ipAddress: meta?.ipAddress ?? null,
  });

  return { token, expiresAt };
}

/** `lastSeenAt` is written at most this often per session, to keep reads cheap. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000;

export interface ResolvedSession {
  sessionId: string;
  user: SessionUser;
}

/** Resolves a raw session-cookie token to its session and user, or null if the
 * token is missing, unknown, or expired. Expired sessions are opportunistically
 * cleaned up rather than left to accumulate. */
export async function getSession(token: string | undefined | null): Promise<ResolvedSession | null> {
  if (!token) return null;

  const session = await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token)))
    .include('user', (u) => u)
    .first();

  if (!session || !session.user) return null;

  const now = Date.now();
  if (new Date(session.expiresAt).getTime() <= now) {
    await db.orm.public.Session.where({ id: session.id }).delete();
    return null;
  }

  if (!session.lastSeenAt || now - new Date(session.lastSeenAt).getTime() > LAST_SEEN_THROTTLE_MS) {
    await db.orm.public.Session.where({ id: session.id }).update({ lastSeenAt: toIsoString(new Date(now)) });
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      emailVerified: session.user.emailVerified !== null,
    },
  };
}

export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  return (await getSession(token))?.user ?? null;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token))).delete();
}

/** Invalidates every session for a user — used on password reset so a
 * compromised password can't keep an attacker's existing session alive. */
export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await db.orm.public.Session.where({ userId }).deleteAll();
}

/** Signs out every other device, keeping only `keepSessionId`. Returns how many were revoked. */
export async function deleteOtherSessions(userId: string, keepSessionId: string): Promise<number> {
  return db.orm.public.Session.where({ userId }).where((s) => s.id.neq(keepSessionId)).deleteAndCount();
}

/** Revokes one session, scoped to its owner. Returns whether a row was deleted. */
export async function deleteSessionById(userId: string, sessionId: string): Promise<boolean> {
  return (await db.orm.public.Session.where({ userId, id: sessionId }).deleteAndCount()) > 0;
}

export async function listSessionsForUser(userId: string) {
  return db.orm.public.Session.where({ userId })
    .where((s) => s.expiresAt.gt(toIsoString(new Date())))
    .orderBy((s) => s.createdAt.desc())
    .all();
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  };
}
