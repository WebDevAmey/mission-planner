/** Vercel (and most proxies) set x-forwarded-for to "client, proxy1, proxy2";
 * the first entry is the original client. Returns null rather than a wrong
 * guess when nothing is present (e.g. local dev without a proxy in front).
 *
 * Trust assumption: the edge in front of the app overwrites x-forwarded-for
 * (Vercel does). A self-hosted deployment must sit behind a proxy that does the
 * same, or per-IP rate limits can be dodged by sending a fake header. Per-email
 * limits apply regardless. */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}
