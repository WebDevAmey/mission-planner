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

/** Resolves a raw session-cookie token to the signed-in user, or null if the
 * token is missing, unknown, or expired. Expired sessions are opportunistically
 * cleaned up rather than left to accumulate. */
export async function getSessionUser(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;

  const session = await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token)))
    .include('user', (u) => u)
    .first();

  if (!session || !session.user) return null;

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await db.orm.public.Session.where({ id: session.id }).delete();
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    emailVerified: session.user.emailVerified !== null,
  };
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token))).delete();
}

/** Invalidates every session for a user — used on password reset so a
 * compromised password can't keep an attacker's existing session alive. */
export async function deleteAllSessionsForUser(userId: string): Promise<void> {
  await db.orm.public.Session.where({ userId }).deleteAll();
}
