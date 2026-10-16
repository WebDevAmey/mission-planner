import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { db } from '@/prisma/db';
import { createSession } from '@/lib/auth/session';
import { hashToken } from '@/lib/auth/tokens';
import { POST as createMissionPOST } from '@/app/api/missions/route';
import { DELETE as sessionsDELETE } from '@/app/api/account/sessions/route';
import { ctx, deleteUser, hasDb, makeUser, req, signInAs, type TestUser } from './helpers';

/**
 * A01 sweep: every route handler under src/app/api is imported and called
 * directly (bypassing proxy.ts), so a handler that forgets its own session or
 * origin check fails here even if the proxy would have caught it.
 */

const API_DIR = join(__dirname, '../../src/app/api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
/** Routes that are meant to work without a session. */
const PUBLIC = new Set([
  'auth/login',
  'auth/signup',
  'auth/logout',
  'auth/forgot-password',
  'auth/reset-password',
  'auth/verify-email',
]);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return name === 'route.ts' ? [full] : [];
  });
}

type Handler = (request: Request, context?: unknown) => Promise<Response>;
interface Route {
  key: string;
  path: string;
  handlers: Partial<Record<(typeof METHODS)[number], Handler>>;
}

async function loadRoutes(): Promise<Route[]> {
  const routes: Route[] = [];
  for (const file of routeFiles(API_DIR)) {
    const key = relative(API_DIR, file).replace(/\/route\.ts$/, '');
    const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
    const handlers: Route['handlers'] = {};
    for (const m of METHODS) if (typeof mod[m] === 'function') handlers[m] = mod[m] as Handler;
    routes.push({ key, path: `/api/${key.replace('[id]', randomUUID())}`, handlers });
  }
  return routes;
}

describe.skipIf(!hasDb)('access control sweep', () => {
  let routes: Route[];
  let user: TestUser;

  beforeAll(async () => {
    routes = await loadRoutes();
    user = await makeUser();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`user:${user.id}`)).deleteAll();
    await deleteUser(user);
  });

  it('finds the API routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(19);
  });

  it('every non-public handler answers 401 without a session', async () => {
    signInAs(null);
    const failures: string[] = [];
    for (const route of routes.filter((r) => !PUBLIC.has(r.key))) {
      for (const [method, handler] of Object.entries(route.handlers)) {
        const res = await handler(req(method, route.path, method === 'GET' ? undefined : {}), ctx(randomUUID()));
        if (res.status !== 401) failures.push(`${method} ${route.key} -> ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('every mutating handler refuses a cross-site Origin (403), signed in or not', async () => {
    const failures: string[] = [];
    for (const signedIn of [true, false]) {
      signInAs(signedIn ? user : null);
      for (const route of routes) {
        for (const [method, handler] of Object.entries(route.handlers)) {
          if (method === 'GET') continue;
          const res = await handler(req(method, route.path, {}, { origin: 'https://evil.example' }), ctx(randomUUID()));
          if (res.status !== 403) failures.push(`${signedIn ? 'in' : 'out'} ${method} ${route.key} -> ${res.status}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('mutations without any Origin header are refused too', async () => {
    signInAs(user);
    const failures: string[] = [];
    for (const route of routes) {
      for (const [method, handler] of Object.entries(route.handlers)) {
        if (method === 'GET') continue;
        const res = await handler(req(method, route.path, {}, { origin: null }), ctx(randomUUID()));
        if (res.status !== 403) failures.push(`${method} ${route.key} -> ${res.status}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("another user's mission id is a 404 on every [id] route and nothing changes", async () => {
    const owner = await makeUser();
    try {
      signInAs(owner);
      const created = await (await createMissionPOST(req('POST', '/api/missions', { name: 'Private' }))).json();
      const id = created.mission.id as string;
      signInAs(user);
      const failures: string[] = [];
      for (const route of routes.filter((r) => r.key.includes('[id]'))) {
        for (const [method, handler] of Object.entries(route.handlers)) {
          const path = `/api/${route.key.replace('[id]', id)}${route.key.endsWith('export') ? '?format=plan' : ''}`;
          const res = await handler(req(method, path, method === 'GET' ? undefined : { name: 'pwned' }), ctx(id));
          if (res.status !== 404) failures.push(`${method} ${route.key} -> ${res.status}`);
        }
      }
      expect(failures).toEqual([]);
      const row = await db.orm.public.Mission.where({ id }).first();
      expect(row?.name).toBe('Private');
      expect(await db.orm.public.Mission.where({ userId: user.id }).all()).toHaveLength(0);
    } finally {
      await deleteUser(owner);
    }
  });

  it("another user's session id cannot be revoked", async () => {
    const owner = await makeUser();
    try {
      const { token } = await createSession(owner.id);
      const session = await db.orm.public.Session.where((s) => s.tokenHash.eq(hashToken(token))).first();
      signInAs(user);
      const res = await sessionsDELETE(req('DELETE', `/api/account/sessions?id=${session!.id}`));
      expect(res.status).toBe(404);
      expect(await db.orm.public.Session.where({ id: session!.id }).first()).not.toBeNull();
    } finally {
      await deleteUser(owner);
    }
  });
});
