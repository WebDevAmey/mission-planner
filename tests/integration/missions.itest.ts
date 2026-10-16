import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { GET as listGET, POST as createPOST } from '@/app/api/missions/route';
import { GET as getOne, PATCH, DELETE } from '@/app/api/missions/[id]/route';
import { POST as duplicatePOST } from '@/app/api/missions/[id]/duplicate/route';
import { ctx, deleteUser, hasDb, makeUser, req, signInAs, waypoint, type TestUser } from './helpers';

describe.skipIf(!hasDb)('missions API', () => {
  let alice: TestUser;
  let bob: TestUser;
  let missionId: string;

  beforeAll(async () => {
    alice = await makeUser();
    bob = await makeUser();
  });

  afterAll(async () => {
    await deleteUser(alice);
    await deleteUser(bob);
  });

  it('401 when signed out', async () => {
    signInAs(null);
    expect((await listGET(req('GET', '/api/missions'))).status).toBe(401);
    expect((await createPOST(req('POST', '/api/missions', {}))).status).toBe(401);
  });

  it('403 on a cross-origin mutation', async () => {
    signInAs(alice);
    const res = await createPOST(req('POST', '/api/missions', {}, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('FORBIDDEN_ORIGIN');
  });

  it('creates a mission with defaults', async () => {
    signInAs(alice);
    const res = await createPOST(req('POST', '/api/missions', { name: 'Alpha' }));
    expect(res.status).toBe(201);
    const { mission } = await res.json();
    expect(mission).toMatchObject({ name: 'Alpha', version: 1, status: 'draft', vehicleType: 'multirotor', zones: [] });
    expect(mission.limits.maxAltM).toBe(400);
    expect(mission.settings.ratedEnduranceS).toBe(1200);
    missionId = mission.id;
  });

  it('creates from a template at a home position', async () => {
    signInAs(alice);
    const res = await createPOST(
      req('POST', '/api/missions', { template: 'simple-survey', home: { latitude: 47.4, longitude: 8.5, altitude: 0 } })
    );
    expect(res.status).toBe(201);
    const { mission } = await res.json();
    expect(mission.items.length).toBeGreaterThan(1);
    expect(mission.summary.distanceM).toBeGreaterThan(0);
    expect((await createPOST(req('POST', '/api/missions', { template: 'nope' }))).status).toBe(400);
  });

  it('404 for a foreign or malformed mission id', async () => {
    signInAs(bob);
    expect((await getOne(req('GET', `/api/missions/${missionId}`), ctx(missionId))).status).toBe(404);
    expect((await PATCH(req('PATCH', `/api/missions/${missionId}`, { name: 'x' }), ctx(missionId))).status).toBe(404);
    expect((await DELETE(req('DELETE', `/api/missions/${missionId}`), ctx(missionId))).status).toBe(404);
    expect((await duplicatePOST(req('POST', `/api/missions/${missionId}/duplicate`), ctx(missionId))).status).toBe(404);
    expect((await getOne(req('GET', '/api/missions/not-a-uuid'), ctx('not-a-uuid'))).status).toBe(404);
  });

  it('400 for invalid input with issue paths', async () => {
    signInAs(alice);
    const res = await PATCH(
      req('PATCH', `/api/missions/${missionId}`, { items: [{ ...waypoint(0, 95, 8), latitude: 95 }] }),
      ctx(missionId)
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.issues[0].path).toBe('items.0.latitude');
    const bad = await PATCH(req('PATCH', `/api/missions/${missionId}`, '{not json'), ctx(missionId));
    expect(bad.status).toBe(400);
  });

  it('PATCH saves items, zones and limits, bumps version, ignores client ids', async () => {
    signInAs(alice);
    const body = {
      baseVersion: 1,
      name: 'Alpha v2',
      homePosition: { latitude: 47.0, longitude: 8.0, altitude: 0 },
      items: [waypoint(0, 47.0, 8.0), waypoint(1, 47.001, 8.0), waypoint(2, 47.001, 8.001)],
      zones: [
        { kind: 'no_fly', shape: 'circle', label: 'Tower', centerLat: 47.5, centerLng: 8.5, radiusM: 100 },
        {
          kind: 'keep_out',
          shape: 'polygon',
          vertices: [
            [8.1, 47.1],
            [8.2, 47.1],
            [8.2, 47.2],
          ],
        },
      ],
      limits: { maxAltM: 120 },
      settings: {
        defaultAltitude: 50,
        defaultSpeed: 10,
        defaultLoiterTime: 30,
        defaultWaitTime: 10,
        altitudeReference: 'relative',
        cruiseSpeed: 8,
      },
    };
    const res = await PATCH(req('PATCH', `/api/missions/${missionId}`, body), ctx(missionId));
    expect(res.status).toBe(200);
    const { mission } = await res.json();
    expect(mission.version).toBe(2);
    expect(mission.items).toHaveLength(3);
    expect(mission.items.map((i: { id: string }) => i.id)).not.toContain('client-0');
    expect(mission.items[1].parameters.param5).toBe(47.001);
    expect(mission.zones).toHaveLength(2);
    expect(mission.limits.maxAltM).toBe(120);
    expect(mission.settings.cruiseSpeed).toBe(8);
    expect(mission.summary.waypointCount).toBe(3);
    expect(mission.summary.distanceM).toBeGreaterThan(100);
    expect(mission.summary.bbox).toEqual([8.0, 47.0, 8.001, 47.001]);
  });

  it('409 with currentVersion when baseVersion is stale', async () => {
    signInAs(alice);
    const res = await PATCH(req('PATCH', `/api/missions/${missionId}`, { baseVersion: 1, name: 'stale' }), ctx(missionId));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, code: 'VERSION_CONFLICT', currentVersion: 2 });
    const ok = await PATCH(req('PATCH', `/api/missions/${missionId}`, { baseVersion: 2, name: 'fresh' }), ctx(missionId));
    expect(ok.status).toBe(200);
    expect((await ok.json()).mission.version).toBe(3);
  });

  it('Prefer: return=minimal answers with id, version, updatedAt and summary only', async () => {
    signInAs(alice);
    const res = await PATCH(
      req('PATCH', `/api/missions/${missionId}`, { baseVersion: 3, name: 'fresh' }, {
        headers: { prefer: 'return=minimal' },
      }),
      ctx(missionId)
    );
    expect(res.status).toBe(200);
    const { ok, mission } = await res.json();
    expect(ok).toBe(true);
    expect(Object.keys(mission).sort()).toEqual(['id', 'summary', 'updatedAt', 'version']);
    expect(mission).toMatchObject({ id: missionId, version: 4 });
    expect(mission.summary.waypointCount).toBe(3);
    // The stored row matches what a fresh read returns.
    const fresh = await (await getOne(req('GET', `/api/missions/${missionId}`), ctx(missionId))).json();
    expect(fresh.mission.version).toBe(4);
    expect(fresh.mission.name).toBe('fresh');
    expect(fresh.mission.updatedAt).toBe(mission.updatedAt);
    expect(fresh.mission.summary).toEqual(mission.summary);
  });

  it('413 over 2,000 items', async () => {
    signInAs(alice);
    const items = Array.from({ length: 2001 }, (_, i) => waypoint(i, 47, 8));
    const res = await PATCH(req('PATCH', `/api/missions/${missionId}`, { items }), ctx(missionId));
    expect(res.status).toBe(413);
  });

  it('rejects a self-intersecting polygon zone', async () => {
    signInAs(alice);
    const zones = [
      {
        kind: 'keep_out',
        shape: 'polygon',
        vertices: [
          [0, 0],
          [1, 1],
          [1, 0],
          [0, 1],
        ],
      },
    ];
    const res = await PATCH(req('PATCH', `/api/missions/${missionId}`, { zones }), ctx(missionId));
    expect(res.status).toBe(400);
  });

  it('lists with summary fields, search and sort', async () => {
    signInAs(alice);
    const res = await listGET(req('GET', '/api/missions?query=fresh&sort=name'));
    expect(res.status).toBe(200);
    const { missions } = await res.json();
    expect(missions).toHaveLength(1);
    expect(missions[0]).toMatchObject({ id: missionId, waypointCount: 3, version: 4 });
    expect(missions[0].distanceM).toBeGreaterThan(0);
    expect((await listGET(req('GET', '/api/missions?sort=bogus'))).status).toBe(400);
    signInAs(bob);
    expect((await (await listGET(req('GET', '/api/missions'))).json()).missions).toHaveLength(0);
  });

  it('duplicates with zones and limits', async () => {
    signInAs(alice);
    const res = await duplicatePOST(req('POST', `/api/missions/${missionId}/duplicate`), ctx(missionId));
    expect(res.status).toBe(201);
    const { mission } = await res.json();
    expect(mission.id).not.toBe(missionId);
    expect(mission.name).toBe('fresh (Copy)');
    expect(mission.items).toHaveLength(3);
    expect(mission.zones).toHaveLength(2);
    expect(mission.limits.maxAltM).toBe(120);
    expect(mission.version).toBe(1);
  });

  it('deletes', async () => {
    signInAs(alice);
    expect((await DELETE(req('DELETE', `/api/missions/${missionId}`, undefined, { origin: null }), ctx(missionId))).status).toBe(403);
    expect((await DELETE(req('DELETE', `/api/missions/${missionId}`), ctx(missionId))).status).toBe(200);
    expect((await getOne(req('GET', `/api/missions/${missionId}`), ctx(missionId))).status).toBe(404);
  });
});
