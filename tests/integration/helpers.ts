import { randomUUID } from 'node:crypto';
import { db } from '@/prisma/db';
import { hashPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE } from '@/lib/auth/session';
import { jar } from './next-headers-mock';

export const hasDb = Boolean(process.env.DATABASE_URL);
export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'correct-horse-battery';

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export async function makeUser(): Promise<TestUser> {
  const email = `it-${randomUUID()}@example.test`;
  const user = await db.orm.public.User.create({ email, passwordHash: await hashPassword(PASSWORD), name: 'IT' });
  const { token } = await createSession(user.id);
  return { id: user.id, email, token };
}

export function signInAs(user: TestUser | null) {
  jar.reset();
  if (user) jar.cookies.set(SESSION_COOKIE, user.token);
}

export function req(
  method: string,
  path: string,
  body?: unknown,
  opts: { origin?: string | null; headers?: Record<string, string> } = {}
): Request {
  const headers = new Headers(opts.headers);
  const origin = opts.origin === undefined ? ORIGIN : opts.origin;
  if (origin) headers.set('origin', origin);
  let payload: string | undefined;
  if (body !== undefined) {
    payload = typeof body === 'string' ? body : JSON.stringify(body);
    headers.set('content-type', 'application/json');
  }
  return new Request(`${ORIGIN}${path}`, { method, headers, body: payload });
}

export const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

export async function deleteUser(user: TestUser | undefined) {
  if (user) await db.orm.public.User.where({ id: user.id }).delete();
}

export function waypoint(i: number, lat: number, lng: number, alt = 50) {
  return {
    id: `client-${i}`,
    sequence: i,
    action: i === 0 ? 'takeoff' : 'waypoint',
    command: i === 0 ? 22 : 16,
    frame: 3,
    name: i === 0 ? 'Takeoff' : `WP ${i}`,
    latitude: lat,
    longitude: lng,
    altitude: alt,
    speed: null,
    notes: null,
    param1: 0,
    param2: 0,
    param3: 0,
    param4: 0,
    param5: lat,
    param6: lng,
    param7: alt,
  };
}
