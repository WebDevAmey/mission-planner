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
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    // Accept a bare host ("example.vercel.app") as well as a full URL.
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(configured) ? configured : `https://${configured}`;
    try {
      return new URL(withScheme).origin;
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
