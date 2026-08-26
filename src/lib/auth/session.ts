import crypto from 'crypto';

export const SESSION_COOKIE = 'mps_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set on the server — add it to .env.local and restart.');
  return s;
}

function sign(issuedAt: string): string {
  return crypto.createHmac('sha256', secret()).update(issuedAt).digest('hex');
}

/** Single shared-password auth: no user table, just a signed cookie proving
 * "someone who knew AUTH_PASSWORD requested this within the last 30 days." */
export function createSessionToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature) return false;
  if (Date.now() - Number(issuedAt) > MAX_AGE_MS) return false;

  const expected = sign(issuedAt);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function checkPassword(candidate: string): boolean {
  const real = process.env.AUTH_PASSWORD;
  if (!real) throw new Error('AUTH_PASSWORD is not set on the server — add it to .env.local and restart.');
  const a = Buffer.from(candidate);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
