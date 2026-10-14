import { db } from '@/prisma/db';
import { toIsoString } from '@/lib/db/serialize';

/**
 * A sliding-window lockout for auth endpoints, backed by the same Postgres
 * database as everything else — no separate cache/queue service to run.
 * Not as fast as an in-memory limiter, but it's correct across every
 * serverless invocation, which an in-process counter would not be.
 */

export type AuthAttemptKind = 'login' | 'signup' | 'forgot_password';

interface RateLimitPolicy {
  windowMs: number;
  maxAttempts: number;
}

const POLICIES: Record<AuthAttemptKind, RateLimitPolicy> = {
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 10 },
  signup: { windowMs: 60 * 60 * 1000, maxAttempts: 5 },
  forgot_password: { windowMs: 60 * 60 * 1000, maxAttempts: 5 },
};

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/** Throws nothing — returns whether the request is allowed, so callers can
 * decide how to respond (always with a generic message; see the route handlers). */
export async function checkRateLimit(identifier: string, kind: AuthAttemptKind): Promise<boolean> {
  const policy = POLICIES[kind];
  const windowStart = toIsoString(new Date(Date.now() - policy.windowMs));

  const recentFailures = await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(identifier))
    .where((a) => a.kind.eq(kind))
    .where((a) => a.success.eq(false))
    .where((a) => a.createdAt.gte(windowStart))
    .aggregate((aggregate) => ({ count: aggregate.count() }));

  return recentFailures.count < policy.maxAttempts;
}

export async function recordAttempt(identifier: string, kind: AuthAttemptKind, success: boolean): Promise<void> {
  await db.orm.public.AuthAttempt.create({ identifier, kind, success });
}
