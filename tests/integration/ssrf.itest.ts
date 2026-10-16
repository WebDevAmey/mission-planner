import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { GET as geoSearchGET } from '@/app/api/geo/search/route';
import { POST as elevationPOST } from '@/app/api/geo/elevation/route';
import { upstreamUrl } from '@/lib/http/upstream';
import { deleteUser, hasDb, makeUser, req, signInAs, type TestUser } from './helpers';

describe('upstreamUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('accepts https and refuses other schemes or credentials', () => {
    expect(upstreamUrl('https://geo.example/search', 'https://fallback.example')).toBe('https://geo.example/search');
    expect(upstreamUrl(undefined, 'https://fallback.example/x')).toBe('https://fallback.example/x');
    expect(upstreamUrl('file:///etc/passwd', 'https://fallback.example/x')).toBe('https://fallback.example/x');
    expect(upstreamUrl('https://user:pw@geo.example', 'https://fallback.example/x')).toBe('https://fallback.example/x');
    vi.stubEnv('NODE_ENV', 'production');
    expect(upstreamUrl('http://geo.example/search', 'https://fallback.example/x')).toBe('https://fallback.example/x');
  });
});

describe.skipIf(!hasDb)('geo proxies', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await deleteUser(user);
  });

  it('never follows upstream redirects and caps the response size', async () => {
    signInAs(user);
    const fetchMock = vi.fn(async () => new Response('x'.repeat(3 * 1024 * 1024), { headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await elevationPOST(req('POST', '/api/geo/elevation', { points: [{ lat: 10.123456, lng: 20.654321 }] }));
    expect(res.status).toBe(502);
    expect((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].redirect).toBe('error');

    const search = await geoSearchGET(req('GET', `/api/geo/search?q=bigbody-${Date.now()}`));
    expect(search.status).toBe(502);
    expect((fetchMock.mock.calls[1] as unknown as [URL, RequestInit])[1].redirect).toBe('error');
  });

  it('elevation lookups are rate limited per user', async () => {
    const other = await makeUser();
    try {
      signInAs(other);
      vi.stubGlobal('fetch', vi.fn(async () => Response.json({ results: [{ elevation: 1 }] })));
      const statuses: number[] = [];
      for (let i = 0; i < 61; i++) {
        const res = await elevationPOST(req('POST', '/api/geo/elevation', { points: [{ lat: 1 + i / 1000, lng: 1 }] }));
        statuses.push(res.status);
      }
      expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
      expect(statuses[60]).toBe(429);
    } finally {
      await deleteUser(other);
    }
  });
});
