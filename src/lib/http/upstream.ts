/**
 * Outbound calls to fixed third-party services (geocoding, elevation).
 *
 * SSRF posture: the host is never user-controlled — it comes from server
 * configuration (GEOCODER_URL / ELEVATION_URL) or a hard-coded default, user
 * input only ever becomes query parameters or a JSON body. On top of that,
 * redirects are refused (a compromised or misconfigured upstream cannot bounce
 * us to an internal address), every call has a timeout, and responses are read
 * with a size cap.
 */

/** A configured upstream URL, or `fallback` when it is missing or unsafe. */
export function upstreamUrl(configured: string | undefined, fallback: string): string {
  if (!configured) return fallback;
  try {
    const url = new URL(configured);
    const httpAllowed = process.env.NODE_ENV !== 'production';
    const schemeOk = url.protocol === 'https:' || (httpAllowed && url.protocol === 'http:');
    if (!schemeOk || url.username || url.password) throw new Error('unsafe');
    return url.href;
  } catch {
    console.error('[config] ignoring invalid or non-https upstream URL; using the default');
    return fallback;
  }
}

export class UpstreamError extends Error {}

/** fetch() a JSON document with no redirects, a timeout and a response size cap. */
export async function fetchUpstreamJson(
  url: string | URL,
  init: RequestInit & { timeoutMs: number; maxBytes: number }
): Promise<unknown> {
  const { timeoutMs, maxBytes, ...rest } = init;
  const res = await fetch(url, { ...rest, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new UpstreamError(`HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) throw new UpstreamError('response too large');
  if (!res.body) throw new UpstreamError('empty response');

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new UpstreamError('response too large');
    }
    chunks.push(value);
  }
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
}
