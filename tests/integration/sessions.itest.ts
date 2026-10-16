import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { GET as sessionsGET } from '@/app/api/account/sessions/route';
import { createSession, getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/tokens';
import { toIsoString } from '@/lib/db/serialize';
import { jar } from './next-headers-mock';
import { deleteUser, hasDb, makeUser, PASSWORD, req, signInAs, type TestUser } from './helpers';

const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!hasDb)('session lifecycle', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(user.email)).deleteAll();
    await deleteUser(user);
  });

  it('a session idle for more than 14 days is rejected and removed', async () => {
    const { token } = await createSession(user.id);
    const tokenHash = hashToken(token);
    await db.orm.public.Session.where((s) => s.tokenHash.eq(tokenHash)).update({
      lastSeenAt: toIsoString(new Date(Date.now() - 15 * DAY)),
    });
    expect(await getSessionUser(token)).toBeNull();
    expect(await db.orm.public.Session.where((s) => s.tokenHash.eq(tokenHash)).first()).toBeNull();
  });

  it('the per-request session lookup does not load the password hash', async () => {
    const { token } = await createSession(user.id);
    const row = await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token)))
      .include('user', (u) => u.select('id', 'email', 'name', 'emailVerified'))
      .first();
    expect(row?.user).not.toHaveProperty('passwordHash');
    expect(await getSessionUser(token)).toEqual({ id: user.id, email: user.email, name: 'IT', emailVerified: false });
  });

  it('a recently used session stays valid', async () => {
    const { token } = await createSession(user.id);
    await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token))).update({
      lastSeenAt: toIsoString(new Date(Date.now() - 2 * DAY)),
    });
    expect((await getSessionUser(token))?.id).toBe(user.id);
  });

  it('idle sessions are not listed as active devices', async () => {
    const { token } = await createSession(user.id);
    await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token))).update({
      lastSeenAt: toIsoString(new Date(Date.now() - 20 * DAY)),
    });
    signInAs(user);
    const { sessions } = await (await sessionsGET()).json();
    const ids = new Set((await db.orm.public.Session.where({ userId: user.id }).all()).filter((s) => s.tokenHash === hashToken(token)).map((s) => s.id));
    expect(sessions.some((s: { id: string }) => ids.has(s.id))).toBe(false);
  });

  it('logging in replaces the session already held by this browser', async () => {
    const { token: old } = await createSession(user.id);
    jar.reset();
    jar.cookies.set(SESSION_COOKIE, old);
    const res = await loginPOST(req('POST', '/api/auth/login', { email: user.email, password: PASSWORD }));
    expect(res.status).toBe(200);
    expect(jar.cookies.get(SESSION_COOKIE)).not.toBe(old);
    expect(await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(old))).first()).toBeNull();
  });
});
