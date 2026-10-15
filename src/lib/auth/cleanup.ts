import { db } from '@/prisma/db';
import { toIsoString } from '@/lib/db/serialize';

const ATTEMPT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Table hygiene for auth data (TECHNICAL_SPEC §3.2): drops AuthAttempt rows
 * older than 30 days and expired sessions / verification / reset tokens.
 * Idempotent; safe to call from a cron route or opportunistically.
 */
export async function cleanupAuthTables(now = new Date()) {
  const nowIso = toIsoString(now);
  const cutoff = toIsoString(new Date(now.getTime() - ATTEMPT_RETENTION_MS));
  const [attempts, sessions, verifications, resets] = await Promise.all([
    db.orm.public.AuthAttempt.where((a) => a.createdAt.lt(cutoff)).deleteAndCount(),
    db.orm.public.Session.where((s) => s.expiresAt.lte(nowIso)).deleteAndCount(),
    db.orm.public.EmailVerificationToken.where((t) => t.expiresAt.lte(nowIso)).deleteAndCount(),
    db.orm.public.PasswordResetToken.where((t) => t.expiresAt.lte(nowIso)).deleteAndCount(),
  ]);
  return { attempts, sessions, verifications, resets };
}

let lastSweep = 0;

/** At most one sweep per instance per hour, never blocking or failing the caller. */
export function maybeCleanupAuthTables(): void {
  const now = Date.now();
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  cleanupAuthTables().catch((err) => console.error('[auth] cleanup failed', err));
}
