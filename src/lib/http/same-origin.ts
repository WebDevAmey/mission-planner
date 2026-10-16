import { securityEvent } from '@/lib/http/security-log';

/**
 * CSRF defense for cookie-authenticated mutating requests: a cross-site form
 * post or <img>/<script> trick can't set a custom header or control the
 * browser-supplied Origin header, so requiring same-origin on every
 * state-changing request blocks them without a token-exchange dance.
 * Pair with the session cookie's `sameSite: 'lax'`, which already blocks the
 * cross-site cookie from attaching to most of these in the first place —
 * this is the defense-in-depth layer for the rest.
 */
export function isSameOriginRequest(request: Request): boolean {
  const ok = checkSameOrigin(request);
  if (!ok) {
    securityEvent('origin_rejected', {
      method: request.method,
      path: new URL(request.url).pathname,
      origin: request.headers.get('origin')?.slice(0, 200) ?? null,
    });
  }
  return ok;
}

function checkSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  // Same-origin requests from fetch() always carry an Origin header for
  // non-GET requests; its absence means something unusual (SSR-to-SSR, a
  // non-browser client, a stripped header) — refuse rather than guess.
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}
