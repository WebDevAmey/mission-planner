import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { POST as loginPOST } from '@/app/api/auth/login/route';
import { POST as signupPOST } from '@/app/api/auth/signup/route';
import { POST as resetPOST } from '@/app/api/auth/reset-password/route';
import { POST as importPOST } from '@/app/api/missions/import/route';
import { readJsonBody } from '@/lib/http/api';
import { deleteUser, hasDb, makeUser, ORIGIN, req, signInAs, type TestUser } from './helpers';

/** A request whose body is streamed in chunks with no Content-Length (chunked transfer). */
function chunkedReq(path: string, totalBytes: number, contentType = 'application/json'): Request {
  const chunk = new TextEncoder().encode('x'.repeat(64 * 1024));
  let sent = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= totalBytes) return controller.close();
      controller.enqueue(chunk);
      sent += chunk.byteLength;
    },
  });
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': contentType },
    body,
    duplex: 'half',
  } as RequestInit);
}

describe('body size caps', () => {
  it('readJsonBody stops reading a chunked body at the cap', async () => {
    const res = await readJsonBody(chunkedReq('/x', 3 * 1024 * 1024), { maxBytes: 1024 * 1024 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(413);
  });

  it('readJsonBody still parses small bodies', async () => {
    const res = await readJsonBody(req('POST', '/x', { a: 1 }));
    expect(res).toEqual({ ok: true, data: { a: 1 } });
  });
});

describe.skipIf(!hasDb)('route body limits', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    await deleteUser(user);
  });

  it('auth routes refuse bodies over 8 KB, chunked or not', async () => {
    signInAs(null);
    expect((await loginPOST(chunkedReq('/api/auth/login', 512 * 1024))).status).toBe(413);
    const big = { email: 'a@example.test', password: 'p'.repeat(20 * 1024) };
    expect((await signupPOST(req('POST', '/api/auth/signup', big))).status).toBe(413);
    expect((await resetPOST(req('POST', '/api/auth/reset-password', { token: 't'.repeat(10 * 1024), password: 'x'.repeat(12) }))).status).toBe(413);
  });

  it('login rejects absurd passwords before hashing them', async () => {
    signInAs(null);
    const res = await loginPOST(req('POST', '/api/auth/login', { email: 'a@example.test', password: 'p'.repeat(1000) }));
    expect(res.status).toBe(400);
  });

  it('multipart import is capped while streaming', async () => {
    signInAs(user);
    const res = await importPOST(chunkedReq('/api/missions/import', 3 * 1024 * 1024, 'multipart/form-data; boundary=x'));
    expect(res.status).toBe(413);
  });
});
