import crypto from 'crypto';

/**
 * Session, email-verification and password-reset tokens all follow the same
 * shape: a high-entropy random value handed to the client (cookie or link),
 * with only its SHA-256 hash stored server-side. A leaked database row can't
 * be replayed into a valid token, and comparison is a simple indexed lookup
 * rather than scanning and timing-comparing every stored hash.
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
