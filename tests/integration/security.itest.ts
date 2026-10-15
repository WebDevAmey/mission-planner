import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { POST as flightDeckPOST } from '@/app/api/flight-deck/route';
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { GET as geoSearchGET } from '@/app/api/geo/search/route';
import { POST as elevationPOST } from '@/app/api/geo/elevation/route';
import { redactEmail } from '@/lib/email/send';
import { cleanupAuthTables } from '@/lib/auth/cleanup';
import { toIsoString } from '@/lib/db/serialize';
import { deleteUser, hasDb, makeUser, req, signInAs, type TestUser } from './helpers';

describe('redactEmail', () => {
  it('keeps only first characters and the TLD', () => {
    expect(redactEmail('jane.doe@example.com')).toBe('j***@e***.com');
  });
});

describe.skipIf(!hasDb)('route hardening', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`user:${user.id}`)).deleteAll();
    await deleteUser(user);
  });

  it('flight-deck: 401, 403, 400, 413 before any model call', async () => {
    signInAs(null);
    expect((await flightDeckPOST(req('POST', '/api/flight-deck', {}))).status).toBe(401);
    signInAs(user);
    expect((await flightDeckPOST(req('POST', '/api/flight-deck', {}, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await flightDeckPOST(req('POST', '/api/flight-deck', '{oops'))).status).toBe(400);
    expect((await flightDeckPOST(req('POST', '/api/flight-deck', { prompt: 'x'.repeat(300 * 1024) }))).status).toBe(413);
  });

  it('flight-deck: 429 once the hourly quota is used', async () => {
    signInAs(user);
    const identifier = `user:${user.id}`;
    for (let i = 0; i < 10; i++) {
      await db.orm.public.AuthAttempt.create({ identifier, kind: 'flight_deck', success: true });
    }
    const body = {
      prompt: 'Survey the field',
      settings: { defaultAltitude: 50, defaultSpeed: 10, defaultLoiterTime: 30, defaultWaitTime: 10, altitudeReference: 'relative' },
      constraints: { maxDistanceM: 5000, maxAltM: 120, minAltM: 10, maxSpeedMs: 15, minAGLClearance: 30, defaultSpeedMs: 10 },
      nfzs: [],
      geofences: [],
      homePosition: null,
    };
    const res = await flightDeckPOST(req('POST', '/api/flight-deck', body));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe('RATE_LIMITED');
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('signup is limited per email as well as per IP', async () => {
    signInAs(null);
    const email = `limit-${Date.now()}@example.test`;
    await db.orm.public.AuthAttempt.createAndCount(
      Array.from({ length: 5 }, () => ({ identifier: `email:${email}`, kind: 'signup', success: false }))
    );
    const res = await signupPOST(
      req('POST', '/api/auth/signup', { email, password: 'long-enough-password' }, { headers: { 'x-forwarded-for': '198.51.100.7' } })
    );
    expect(res.status).toBe(429);
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`email:${email}`)).deleteAll();
  });

  it('geo search proxies, caches and throttles per user', async () => {
    signInAs(user);
    const fetchMock = vi.fn(async () =>
      Response.json([{ display_name: 'Zurich, Switzerland', lat: '47.37', lon: '8.54', boundingbox: ['47.3', '47.4', '8.4', '8.6'], type: 'city' }])
    );
    vi.stubGlobal('fetch', fetchMock);
    const q = `zurich-${Date.now()}`;
    const res = await geoSearchGET(req('GET', `/api/geo/search?q=${q}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ lat: 47.37, lng: 8.54, bbox: [8.4, 47.3, 8.6, 47.4] });
    const calledWith = new Headers((fetchMock.mock.calls[0] as unknown as [URL, RequestInit])[1].headers);
    expect(calledWith.get('User-Agent')).toMatch(/FlightDeck/);

    // Cached: no second upstream call, not throttled.
    expect((await geoSearchGET(req('GET', `/api/geo/search?q=${q}`))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A different query within 1 s is throttled.
    expect((await geoSearchGET(req('GET', `/api/geo/search?q=${q}-2`))).status).toBe(429);
    expect((await geoSearchGET(req('GET', '/api/geo/search?q=a'))).status).toBe(400);
  });

  it('elevation proxy batches and caps at 100 points', async () => {
    signInAs(user);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ results: [{ elevation: 412 }, { elevation: 515.5 }] }))
    );
    const res = await elevationPOST(
      req('POST', '/api/geo/elevation', { points: [{ lat: 47.1, lng: 8.1 }, { lat: 47.2, lng: 8.2 }] })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).elevations).toEqual([412, 515.5]);
    const tooMany = Array.from({ length: 101 }, () => ({ lat: 1, lng: 1 }));
    expect((await elevationPOST(req('POST', '/api/geo/elevation', { points: tooMany }))).status).toBe(400);
  });

  it('cleanup removes old attempts and expired sessions', async () => {
    const old = toIsoString(new Date(Date.now() - 40 * 24 * 3600 * 1000));
    const attempt = await db.orm.public.AuthAttempt.create({ identifier: 'cleanup-test', kind: 'login', success: false, createdAt: old });
    const session = await db.orm.public.Session.create({
      tokenHash: `expired-${Date.now()}`,
      userId: user.id,
      expiresAt: toIsoString(new Date(Date.now() - 1000)),
    });
    await cleanupAuthTables();
    expect(await db.orm.public.AuthAttempt.where({ id: attempt.id }).first()).toBeNull();
    expect(await db.orm.public.Session.where({ id: session.id }).first()).toBeNull();
  });
});
