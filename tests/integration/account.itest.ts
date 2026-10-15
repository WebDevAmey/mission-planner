import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { createSession, SESSION_COOKIE } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { GET as accountGET, PATCH as accountPATCH, DELETE as accountDELETE } from '@/app/api/account/route';
import { POST as passwordPOST } from '@/app/api/account/password/route';
import { GET as sessionsGET, DELETE as sessionsDELETE } from '@/app/api/account/sessions/route';
import { POST as createPOST } from '@/app/api/missions/route';
import { jar } from './next-headers-mock';
import { deleteUser, hasDb, makeUser, PASSWORD, req, signInAs, type TestUser } from './helpers';

describe.skipIf(!hasDb)('account API', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    await deleteUser(user);
  });

  it('401 when signed out', async () => {
    signInAs(null);
    expect((await accountGET(req('GET', '/api/account'))).status).toBe(401);
    expect((await sessionsGET()).status).toBe(401);
    expect((await passwordPOST(req('POST', '/api/account/password', {}))).status).toBe(401);
  });

  it('reads and renames the profile', async () => {
    signInAs(user);
    const res = await accountPATCH(req('PATCH', '/api/account', { name: '  Ada  ' }));
    expect(res.status).toBe(200);
    expect((await res.json()).user).toMatchObject({ name: 'Ada', email: user.email, emailVerified: false });
    expect((await accountPATCH(req('PATCH', '/api/account', { name: 'x'.repeat(121) }))).status).toBe(400);
    expect((await accountPATCH(req('PATCH', '/api/account', { name: 'y' }, { origin: 'https://evil.example' }))).status).toBe(403);
  });

  it('lists sessions and revokes other devices', async () => {
    await createSession(user.id, { userAgent: 'Mozilla/5.0 (iPhone) Mobile Safari/605.1', ipAddress: '203.0.113.42' });
    signInAs(user);
    const list = await (await sessionsGET()).json();
    expect(list.sessions.length).toBeGreaterThanOrEqual(2);
    expect(list.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    expect(list.sessions.find((s: { ipAddress: string | null }) => s.ipAddress === '203.0.113.x')).toBeTruthy();

    const res = await sessionsDELETE(req('DELETE', '/api/account/sessions?scope=others'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, signedOut: false });
    const after = await (await sessionsGET()).json();
    expect(after.sessions).toHaveLength(1);
  });

  it('rejects a wrong current password and changes the password, rotating the session', async () => {
    signInAs(user);
    const wrong = await passwordPOST(
      req('POST', '/api/account/password', { currentPassword: 'nope-nope-nope', newPassword: 'a-brand-new-password' })
    );
    expect(wrong.status).toBe(403);
    expect((await wrong.json()).code).toBe('INVALID_CREDENTIALS');

    const oldToken = user.token;
    const ok = await passwordPOST(
      req('POST', '/api/account/password', { currentPassword: PASSWORD, newPassword: 'a-brand-new-password' })
    );
    expect(ok.status).toBe(200);
    const newToken = jar.cookies.get(SESSION_COOKIE);
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(oldToken);

    const row = await db.orm.public.User.where({ id: user.id }).first();
    expect(await verifyPassword('a-brand-new-password', row!.passwordHash)).toBe(true);

    // Old session is gone; the new one works.
    signInAs(user);
    expect((await accountGET(req('GET', '/api/account'))).status).toBe(401);
    user.token = newToken!;
    signInAs(user);
    expect((await accountGET(req('GET', '/api/account'))).status).toBe(200);
  });

  it('deletes the account with password re-entry and cascades missions', async () => {
    const victim = await makeUser();
    signInAs(victim);
    const created = await createPOST(req('POST', '/api/missions', { name: 'Doomed' }));
    const missionId = (await created.json()).mission.id as string;

    expect((await accountDELETE(req('DELETE', '/api/account', { password: 'wrong-password' }))).status).toBe(403);
    expect((await accountDELETE(req('DELETE', '/api/account', {}))).status).toBe(400);

    const res = await accountDELETE(req('DELETE', '/api/account', { password: PASSWORD }));
    expect(res.status).toBe(200);
    expect(jar.cookies.has(SESSION_COOKIE)).toBe(false);
    expect(await db.orm.public.User.where({ id: victim.id }).first()).toBeNull();
    expect(await db.orm.public.Mission.where({ id: missionId }).first()).toBeNull();
    expect(await db.orm.public.Session.where({ userId: victim.id }).first()).toBeNull();
  });
});
