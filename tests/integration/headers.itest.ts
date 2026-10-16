import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config';

async function headersFor(source: string) {
  const rules = (await nextConfig.headers!()) ?? [];
  const rule = rules.find((r) => r.source === source);
  return new Map((rule?.headers ?? []).map((h) => [h.key.toLowerCase(), h.value]));
}

describe('security headers (next.config.ts)', () => {
  it('sends the baseline headers on every route', async () => {
    const h = await headersFor('/(.*)');
    expect(h.get('x-frame-options')).toBe('DENY');
    expect(h.get('x-content-type-options')).toBe('nosniff');
    expect(h.get('cross-origin-opener-policy')).toBe('same-origin');
    const csp = h.get('content-security-policy')!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('googleapis');
  });

  it('marks API responses as not cacheable', async () => {
    const h = await headersFor('/api/:path*');
    expect(h.get('cache-control')).toBe('no-store, no-transform');
  });

  it('turns off x-powered-by', () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
