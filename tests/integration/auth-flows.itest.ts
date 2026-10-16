import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { POST as forgotPOST } from '@/app/api/auth/forgot-password/route';
import { deleteUser, hasDb, makeUser, req, signInAs, type TestUser } from './helpers';

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
