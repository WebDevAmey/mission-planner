import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as forgotPOST } from '@/app/api/auth/forgot-password/route';
import { PATCH as accountPATCH } from '@/app/api/account/route';
import { sendEmail } from '@/lib/email/send';
import { deleteUser, hasDb, makeUser, PASSWORD, req, signInAs, type TestUser } from './helpers';

function captureLogs() {
  const lines: string[] = [];
  for (const level of ['info', 'warn', 'error', 'log'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : JSON.stringify(a))).join(' '));
    });
  }
  return lines;
}

const events = (lines: string[]) =>
  lines.filter((l) => l.startsWith('{"type":"security"')).map((l) => JSON.parse(l) as Record<string, unknown>);

describe.skipIf(!hasDb)('security logging', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(user.email)).deleteAll();
    await deleteUser(user);
  });

  it('logs login failures and successes without emails or passwords', async () => {
    vi.stubEnv('SECURITY_LOG_IN_TESTS', '1');
    const lines = captureLogs();
    signInAs(null);
    await loginPOST(req('POST', '/api/auth/login', { email: user.email, password: 'wrong-password-123' }));
    await loginPOST(req('POST', '/api/auth/login', { email: user.email, password: PASSWORD }));
    const ev = events(lines);
    expect(ev.map((e) => e.event)).toEqual(['login_failed', 'login_success']);
    expect(ev[0]).toMatchObject({ userId: user.id });
    const all = lines.join('\n');
    expect(all).not.toContain(user.email);
    expect(all).not.toContain(PASSWORD);
    expect(all).not.toContain('wrong-password-123');
  });

  it('logs rejected cross-site requests', async () => {
    vi.stubEnv('SECURITY_LOG_IN_TESTS', '1');
    const lines = captureLogs();
    signInAs(user);
    await accountPATCH(req('PATCH', '/api/account', { name: 'x' }, { origin: 'https://evil.example' }));
    expect(events(lines)).toEqual([expect.objectContaining({ event: 'origin_rejected', origin: 'https://evil.example', path: '/api/account' })]);
  });

  it('never logs reset tokens or the reset link', async () => {
    vi.stubEnv('SECURITY_LOG_IN_TESTS', '1');
    const lines = captureLogs();
    signInAs(null);
    const body = await (await forgotPOST(req('POST', '/api/auth/forgot-password', { email: user.email }))).json();
    const token = new URL(body.devResetUrl).searchParams.get('token')!;
    expect(lines.join('\n')).not.toContain(token);
    expect(lines.join('\n')).not.toContain(user.email);
  });
  it('email delivery has a timeout and redacts the address on failure', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    const lines = captureLogs();
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(
      async () => new Response(`bad recipient ${user.email}`, { status: 422 })
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendEmail({ to: user.email, subject: 's', html: 'h', text: 't' });
    expect(result.delivered).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(lines.join('\n')).not.toContain(user.email);
    expect(lines.join('\n')).not.toContain('test-key');
  });
});
