/** Vercel (and most proxies) set x-forwarded-for to "client, proxy1, proxy2";
 * the first entry is the original client. Returns null rather than a wrong
 * guess when nothing is present (e.g. local dev without a proxy in front). */
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip');
}
