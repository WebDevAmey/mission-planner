/**
 * The origin used in links we email (verification, password reset).
 *
 * Never derived from the request's Origin or Host header: on a self-hosted
 * deployment those are attacker-controlled, and a reset link pointing at the
 * attacker's host leaks the token when the victim clicks it ("password reset
 * poisoning"). Order: APP_URL (set this in production), then the Vercel
 * production / deployment URL, then — local development only — the request URL.
 */
export function appOrigin(request: Request): string {
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      console.error('[config] APP_URL is not a valid URL; ignoring it');
    }
  }
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return new URL(request.url).origin;
}
