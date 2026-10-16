import crypto from 'crypto';

/**
 * Security event log (OWASP A09): one JSON line per event on stdout, picked up
 * by the platform's log drain. Never pass passwords, tokens, cookies or raw
 * email addresses: use `subjectRef()` for an email so repeated attempts against
 * one account can be correlated without storing the address.
 */
export type SecurityEvent =
  | 'login_success'
  | 'login_failed'
  | 'login_throttled'
  | 'signup'
  | 'signup_throttled'
  | 'password_reset_requested'
  | 'password_reset_throttled'
  | 'password_reset_completed'
  | 'password_reset_rejected'
  | 'password_changed'
  | 'password_change_failed'
  | 'sessions_revoked'
  | 'logout'
  | 'account_deleted'
  | 'account_delete_failed'
  | 'origin_rejected'
  | 'quota_exceeded';

type Fields = Record<string, string | number | boolean | null | undefined>;

/** A stable, non-reversible reference for an email (or other identifier). */
export function subjectRef(value: string): string {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export function securityEvent(event: SecurityEvent, fields: Fields = {}): void {
  if (process.env.NODE_ENV === 'test' && !process.env.SECURITY_LOG_IN_TESTS) return;
  console.info(JSON.stringify({ type: 'security', event, at: new Date().toISOString(), ...fields }));
}
