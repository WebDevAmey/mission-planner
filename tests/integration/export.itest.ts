import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

import { POST as createPOST } from '@/app/api/missions/route';
import { PATCH } from '@/app/api/missions/[id]/route';
import { GET as exportGET } from '@/app/api/missions/[id]/export/route';
import { POST as importPOST } from '@/app/api/missions/import/route';
import { ctx, deleteUser, hasDb, makeUser, ORIGIN, req, signInAs, waypoint, type TestUser } from './helpers';

describe.skipIf(!hasDb)('export / import API', () => {
  let alice: TestUser;
  let bob: TestUser;
  let missionId: string;

  beforeAll(async () => {
    alice = await makeUser();
    bob = await makeUser();
    signInAs(alice);
    const created = await createPOST(req('POST', '/api/missions', { name: 'Export Me!' }));
    missionId = (await created.json()).mission.id;
    const rtl = { ...waypoint(3, 0, 0), action: 'rtl', command: 20, name: 'RTL', latitude: null, longitude: null, altitude: null, param5: 0, param6: 0, param7: 0 };
    await PATCH(
      req('PATCH', `/api/missions/${missionId}`, {
        homePosition: { latitude: 47.0, longitude: 8.0, altitude: 0 },
        items: [waypoint(0, 47.0, 8.0), waypoint(1, 47.001, 8.0), waypoint(2, 47.001, 8.001), rtl],
        zones: [{ kind: 'no_fly', shape: 'circle', label: 'Far', centerLat: 48, centerLng: 9, radiusM: 50 }],
      }),
      ctx(missionId)
    );
  });

  afterAll(async () => {
    await deleteUser(alice);
    await deleteUser(bob);
  });

  const exp = (format: string, extra = '') =>
    exportGET(req('GET', `/api/missions/${missionId}/export?format=${format}${extra}`), ctx(missionId));

  it.each([
    ['plan', 'application/json', '.plan'],
    ['waypoints', 'text/plain', '.waypoints'],
    ['kml', 'application/vnd.google-earth.kml+xml', '.kml'],
    ['geojson', 'application/geo+json', '.geojson'],
    ['csv', 'text/csv', '.csv'],
    ['json', 'application/json', '.json'],
  ])('exports %s with type and slugged filename', async (format, type, ext) => {
    signInAs(alice);
    const res = await exp(format);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(type);
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toMatch(new RegExp(`^attachment; filename="export-me_\\d{8}-\\d{6}\\${ext}"$`));
    const text = await res.text();
    expect(text.length).toBeGreaterThan(20);
    if (format === 'plan') {
      const plan = JSON.parse(text);
      expect(plan.fileType).toBe('Plan');
      expect(plan.mission.items.length).toBeGreaterThanOrEqual(4);
      expect(plan.geoFence.circles).toHaveLength(1);
    }
    if (format === 'waypoints') expect(text.startsWith('QGC WPL 110')).toBe(true);
  });

  it('400 unknown format, 404 foreign mission', async () => {
    signInAs(alice);
    expect((await exp('docx')).status).toBe(400);
    signInAs(bob);
    expect((await exp('plan')).status).toBe(404);
  });

  it('422 for a flight format with validation errors unless forced', async () => {
    signInAs(alice);
    await PATCH(req('PATCH', `/api/missions/${missionId}`, { limits: { maxAltM: 20 } }), ctx(missionId));
    const res = await exp('plan');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe('UNPROCESSABLE');
    expect(body.validationIssues.some((i: { code: string }) => i.code === 'ALT_ABOVE_MAX')).toBe(true);
    expect((await exp('plan', '&force=1')).status).toBe(200);
    expect((await exp('geojson')).status).toBe(200);
  });

  it('round-trips a .plan through import (JSON body and multipart)', async () => {
    signInAs(alice);
    const planText = await (await exp('plan', '&force=1')).text();

    const res = await importPOST(req('POST', '/api/missions/import', { filename: 'survey.plan', content: planText }));
    expect(res.status).toBe(201);
    const { mission, warnings } = await res.json();
    expect(Array.isArray(warnings)).toBe(true);
    expect(mission.name).toBe('survey');
    expect(mission.items).toHaveLength(4);
    expect(mission.items[1].latitude).toBeCloseTo(47.001, 6);
    expect(mission.zones).toHaveLength(1);
    expect(mission.homePosition.latitude).toBeCloseTo(47.0, 6);

    const form = new FormData();
    form.set('file', new File([planText], 'from-upload.plan', { type: 'application/json' }));
    const multipart = await importPOST(
      new Request(`${ORIGIN}/api/missions/import`, { method: 'POST', body: form, headers: { origin: ORIGIN } })
    );
    expect(multipart.status).toBe(201);
    expect((await multipart.json()).mission.name).toBe('from-upload');
  });

  it('imports .waypoints and rejects junk or oversize files', async () => {
    signInAs(alice);
    const wpl = await (await exp('waypoints', '&force=1')).text();
    const res = await importPOST(req('POST', '/api/missions/import', { filename: 'm.waypoints', content: wpl }));
    expect(res.status).toBe(201);
    expect((await res.json()).mission.items.length).toBeGreaterThanOrEqual(3);

    const junk = await importPOST(req('POST', '/api/missions/import', { filename: 'x.docx', content: 'hello' }));
    expect(junk.status).toBe(400);
    expect((await junk.json()).code).toBe('VALIDATION_FAILED');

    const big = await importPOST(req('POST', '/api/missions/import', { filename: 'big.plan', content: 'x'.repeat(1024 * 1024 + 10) }));
    expect(big.status).toBe(413);

    signInAs(null);
    expect((await importPOST(req('POST', '/api/missions/import', { filename: 'm.waypoints', content: wpl }))).status).toBe(401);
  });
});
