import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { POST as forgotPOST } from '@/app/api/auth/forgot-password/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as resetPOST } from '@/app/api/auth/reset-password/route';
import { POST as passwordPOST } from '@/app/api/account/password/route';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { toIsoString } from '@/lib/db/serialize';
import { deleteUser, hasDb, makeUser, PASSWORD, req, signInAs, type TestUser } from './helpers';

async function issueResetToken(userId: string): Promise<string> {
  const token = generateToken();
  await db.orm.public.PasswordResetToken.create({
    tokenHash: hashToken(token),
    userId,
    expiresAt: toIsoString(new Date(Date.now() + 3600_000)),
  });
  return token;
}

describe.skipIf(!hasDb)('auth flows', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(user.email)).deleteAll();
    await deleteUser(user);
  });

  it('forgot-password is limited to 5 requests per hour per email', async () => {
    signInAs(null);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await forgotPOST(req('POST', '/api/auth/forgot-password', { email: user.email }))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe.skipIf(!hasDb)('emailed links', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(user.email)).deleteAll();
    await deleteUser(user);
  });

  it('reset links use the configured APP_URL, never the request Host/Origin', async () => {
    signInAs(null);
    vi.stubEnv('APP_URL', 'https://flightdeck.example');
    const evil = new Request('https://evil.example/api/auth/forgot-password', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ email: user.email }),
    });
    const body = await (await forgotPOST(evil)).json();
    expect(body.devResetUrl).toMatch(/^https:\/\/flightdeck\.example\/reset-password\?token=/);
  });
});

describe.skipIf(!hasDb)('password reset tokens', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`user:${user.id}`)).deleteAll();
    await deleteUser(user);
  });

  it('a reset token works exactly once, even under concurrent use', async () => {
    signInAs(null);
    const token = await issueResetToken(user.id);
    const attempt = (password: string) => resetPOST(req('POST', '/api/auth/reset-password', { token, password }));
    const statuses = (await Promise.all([attempt('first-new-password'), attempt('second-new-password')])).map((r) => r.status);
    expect(statuses.sort()).toEqual([200, 400]);
    expect((await attempt('third-new-password')).status).toBe(400);
  });

  it('changing the password invalidates outstanding reset links', async () => {
    const fresh = await makeUser();
    try {
      const token = await issueResetToken(fresh.id);
      signInAs(fresh);
      const changed = await passwordPOST(
        req('POST', '/api/account/password', { currentPassword: PASSWORD, newPassword: 'brand-new-password-1' })
      );
      expect(changed.status).toBe(200);
      signInAs(null);
      const res = await resetPOST(req('POST', '/api/auth/reset-password', { token, password: 'attacker-password-1' }));
      expect(res.status).toBe(400);
    } finally {
      await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`user:${fresh.id}`)).deleteAll();
      await deleteUser(fresh);
    }
  });
});

describe.skipIf(!hasDb)('login throttling', () => {
  const ip = '203.0.113.77';

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`ip:${ip}`)).deleteAll();
  });

  it('caps failed logins per IP across many emails (credential stuffing)', async () => {
    signInAs(null);
    await db.orm.public.AuthAttempt.createAndCount(
      Array.from({ length: 50 }, () => ({ identifier: `ip:${ip}`, kind: 'login_ip', success: false }))
    );
    const res = await loginPOST(
      req('POST', '/api/auth/login', { email: `fresh-${Date.now()}@example.test`, password: 'whatever-password' }, { headers: { 'x-forwarded-for': ip } })
    );
    expect(res.status).toBe(429);
  });

  it('records a failed login against the IP as well as the email', async () => {
    signInAs(null);
    const other = '203.0.113.78';
    await loginPOST(req('POST', '/api/auth/login', { email: `x-${Date.now()}@example.test`, password: 'nope-nope-nope' }, { headers: { 'x-forwarded-for': other } }));
    const rows = await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`ip:${other}`)).all();
    expect(rows.length).toBe(1);
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`ip:${other}`)).deleteAll();
  });
});
