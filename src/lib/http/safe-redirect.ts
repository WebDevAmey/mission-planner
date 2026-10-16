const PROBE_ORIGIN = 'http://flightdeck.invalid';

/**
 * Returns `value` when it is a same-site path ("/missions/1?x=y#z") that is safe
 * to navigate to after sign-in, otherwise null. Rejects absolute and
 * protocol-relative URLs ("//evil", "/\\evil" — browsers treat "\" as "/"),
 * other schemes (javascript:, data:) and control characters.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 2048) return null;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return null;
    return url.pathname + url.search + url.hash === value ? value : null;
  } catch {
    return null;
  }
}
