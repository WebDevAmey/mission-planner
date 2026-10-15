import { db } from '@/prisma/db';
import { toIsoString } from '@/lib/db/serialize';

/**
 * A sliding-window lockout for auth endpoints, backed by the same Postgres
 * database as everything else — no separate cache/queue service to run.
 * Not as fast as an in-memory limiter, but it's correct across every
 * serverless invocation, which an in-process counter would not be.
 */

export type AuthAttemptKind =
  | 'login'
  | 'signup'
  | 'forgot_password'
  | 'resend_verification'
  | 'password_change'
  | 'account_delete';

interface RateLimitPolicy {
  windowMs: number;
  maxAttempts: number;
  /** Count every attempt (a usage quota) rather than only failures (a lockout). */
  countSuccess?: boolean;
}

const HOUR = 60 * 60 * 1000;

const POLICIES: Record<AuthAttemptKind, RateLimitPolicy> = {
  login: { windowMs: 15 * 60 * 1000, maxAttempts: 10 },
  signup: { windowMs: HOUR, maxAttempts: 5, countSuccess: true },
  forgot_password: { windowMs: HOUR, maxAttempts: 5 },
  resend_verification: { windowMs: HOUR, maxAttempts: 5, countSuccess: true },
  password_change: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
  account_delete: { windowMs: 15 * 60 * 1000, maxAttempts: 5 },
};

export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

/** Throws nothing — returns whether the request is allowed, so callers can
 * decide how to respond (always with a generic message; see the route handlers). */
export async function checkRateLimit(identifier: string, kind: AuthAttemptKind): Promise<boolean> {
  const policy = POLICIES[kind];
  const windowStart = toIsoString(new Date(Date.now() - policy.windowMs));

  return (await countAttempts(identifier, kind, windowStart, !policy.countSuccess)) < policy.maxAttempts;
}

async function countAttempts(identifier: string, kind: string, sinceIso: string, failuresOnly: boolean) {
  let q = db.orm.public.AuthAttempt.where((a) => a.identifier.eq(identifier))
    .where((a) => a.kind.eq(kind))
    .where((a) => a.createdAt.gte(sinceIso));
  if (failuresOnly) q = q.where((a) => a.success.eq(false));
  const { count } = await q.aggregate((aggregate) => ({ count: aggregate.count() }));
  return count;
}

export interface QuotaWindow {
  windowMs: number;
  max: number;
}

/**
 * A per-key usage quota over several windows (e.g. 10/hour and 50/day for
 * Flight Deck runs), stored in the same AuthAttempt table. Records the use
 * when allowed. Returns the seconds until the tightest exhausted window frees
 * up when refused.
 */
export async function consumeQuota(
  identifier: string,
  kind: string,
  windows: QuotaWindow[]
): Promise<{ allowed: true } | { allowed: false; retryAfterS: number }> {
  for (const w of windows) {
    const since = new Date(Date.now() - w.windowMs);
    const used = await countAttempts(identifier, kind, toIsoString(since), false);
    if (used >= w.max) {
      const oldest = await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(identifier))
        .where((a) => a.kind.eq(kind))
        .where((a) => a.createdAt.gte(toIsoString(since)))
        .orderBy((a) => a.createdAt.asc())
        .first();
      const freesAt = oldest ? new Date(oldest.createdAt).getTime() + w.windowMs : Date.now() + w.windowMs;
      return { allowed: false, retryAfterS: Math.max(1, Math.ceil((freesAt - Date.now()) / 1000)) };
    }
  }
  await db.orm.public.AuthAttempt.create({ identifier, kind, success: true });
  return { allowed: true };
}

export async function recordAttempt(identifier: string, kind: AuthAttemptKind, success: boolean): Promise<void> {
  await db.orm.public.AuthAttempt.create({ identifier, kind, success });
}
