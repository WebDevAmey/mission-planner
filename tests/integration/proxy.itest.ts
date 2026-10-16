import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import proxy from '@/proxy';
import { safeNextPath } from '@/lib/http/safe-redirect';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { deleteUser, hasDb, makeUser, type TestUser } from './helpers';

const BASE = 'http://localhost:3000';

describe('safeNextPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/missions/abc?tab=checks#x', '/missions/abc?tab=checks#x'],
    ['//evil.example', null],
    ['/\\evil.example', null],
    ['\\\\evil.example', null],
    ['https://evil.example/x', null],
    ['javascript:alert(1)', null],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
    ['/ok\nheader', null],
    ['', null],
  ])('%j -> %j', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe('proxy', () => {
  it('strips an off-site ?next= from /login', async () => {
    const res = await proxy(new NextRequest(`${BASE}/login?next=//evil.example/phish`));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.origin).toBe(BASE);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBeNull();
  });

  it('keeps a same-site ?next=', async () => {
    const res = await proxy(new NextRequest(`${BASE}/login?next=/missions/1`));
    expect(res.headers.get('location')).toBeNull();
  });

  it('401s protected API calls without a session cookie', async () => {
    const res = await proxy(new NextRequest(`${BASE}/api/missions`));
    expect(res.status).toBe(401);
  });

  it('sends signed-out page visits to /login with the path as next', async () => {
    const res = await proxy(new NextRequest(`${BASE}/dashboard?x=1`));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location')!).searchParams.get('next')).toBe('/dashboard?x=1');
  });
});

describe.skipIf(!hasDb)('proxy with a session', () => {
  let user: TestUser;
  beforeAll(async () => {
    user = await makeUser();
  });
  afterAll(async () => {
    await deleteUser(user);
  });

  it('signed-in visit to /login goes to a safe next, else the dashboard', async () => {
    const withCookie = (url: string) => {
      const r = new NextRequest(url);
      r.cookies.set(SESSION_COOKIE, user.token);
      return r;
    };
    expect(new URL((await proxy(withCookie(`${BASE}/login?next=/settings`))).headers.get('location')!).pathname).toBe('/settings');
    expect(new URL((await proxy(withCookie(`${BASE}/login?next=//evil.example`))).headers.get('location')!).href).toBe(`${BASE}/dashboard`);
  });

  it('does not redirect RSC prefetches of /login for signed-in users', async () => {
    const r = new NextRequest(`${BASE}/login?_rsc=abc`, { headers: { rsc: '1', 'next-router-prefetch': '1' } });
    r.cookies.set(SESSION_COOKIE, user.token);
    expect((await proxy(r)).headers.get('location')).toBeNull();
  });

  it('does not redirect router fetches of /login once Next has stripped the RSC headers', async () => {
    // What the proxy really receives for a prefetch: no rsc/next-router-* headers, no _rsc.
    const fetchReq = new NextRequest(`${BASE}/login`, { headers: { 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors' } });
    fetchReq.cookies.set(SESSION_COOKIE, user.token);
    expect((await proxy(fetchReq)).headers.get('location')).toBeNull();

    const pageLoad = new NextRequest(`${BASE}/login`, { headers: { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' } });
    pageLoad.cookies.set(SESSION_COOKIE, user.token);
    expect(new URL((await proxy(pageLoad)).headers.get('location')!).pathname).toBe('/dashboard');
  });
});
