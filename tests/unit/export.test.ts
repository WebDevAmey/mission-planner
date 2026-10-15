import { describe, expect, it } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import {
  buildCsv,
  buildGeoJson,
  buildKml,
  buildMpsJson,
  buildQgcPlan,
  buildWaypointsFile,
  exportMissionFile,
  parseMissionFile,
  parseMpsJson,
  parsePlan,
  parseWaypoints,
  slugFilename,
} from '@/lib/domain/export';
import type { Zone } from '@/lib/domain/zones';
import type { MissionItem } from '@/types/mission';
import { item, plan } from './fixtures';

const NOW = new Date('2026-01-15T09:30:00Z');

function golden() {
  return plan(
    [
      item(PlannerAction.TAKEOFF, 47.0, 8.0, 30, { id: 'a' }),
      item(PlannerAction.WAYPOINT, 47.001, 8.0, 50, { id: 'b', speed: 8 }),
      item(PlannerAction.LOITER, 47.001, 8.0015, 50, { id: 'c', notes: 'orbit, "tower"' }),
      item(PlannerAction.CAM_TRIGG_DIST, undefined, undefined, undefined, { id: 'd' }),
      item(PlannerAction.WAYPOINT, 47.0, 8.0015, 60, { id: 'e' }),
      item(PlannerAction.DO_JUMP, undefined, undefined, undefined, {
        id: 'f',
        parameters: { param1: 3, param2: 2, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0 },
      }),
      item(PlannerAction.RTL, undefined, undefined, undefined, { id: 'g' }),
    ],
    { name: 'Golden Field #1', homePosition: { latitude: 47.0, longitude: 8.0, altitude: 420 } }
  );
}

const ZONES: Zone[] = [
  { id: 'z1', kind: 'keep_out', shape: 'polygon', label: 'Barn & yard', enabled: true, vertices: [[8.002, 47.002], [8.003, 47.002], [8.003, 47.003]] },
  { id: 'z2', kind: 'no_fly', shape: 'circle', label: 'Mast', enabled: true, centerLat: 46.999, centerLng: 8.003, radiusM: 50 },
  { id: 'z3', kind: 'keep_in', shape: 'polygon', label: 'Site', enabled: true, vertices: [[7.99, 46.99], [8.01, 46.99], [8.01, 47.01], [7.99, 47.01]] },
  { id: 'z4', kind: 'keep_out', shape: 'circle', label: 'Off', enabled: false, centerLat: 47, centerLng: 8, radiusM: 5 },
];

/** Comparable item fields (ids and names are regenerated on import). */
const shape = (items: MissionItem[]) =>
  items.map((i) => ({ action: i.action, frame: i.frame, lat: i.latitude, lng: i.longitude, alt: i.altitude, speed: i.speed, p: i.parameters }));

describe('golden files', () => {
  it('.plan', async () => {
    const out = buildQgcPlan(golden(), { zones: ZONES, rallyPoints: [{ latitude: 47.0005, longitude: 8.0005, altitude: 30 }] });
    await expect(out).toMatchFileSnapshot('golden/mission.plan');
    const doc = JSON.parse(out);
    expect(doc.mission.firmwareType).toBe(3);
    expect(doc.mission.vehicleType).toBe(2);
    expect(doc.geoFence.polygons.map((p: { inclusion: boolean }) => p.inclusion)).toEqual([false, true]);
    expect(doc.geoFence.circles).toHaveLength(1);
    // DO_JUMP -> item 3 (the loiter) is wire seq 4 because of the inserted DO_CHANGE_SPEED row.
    const jump = doc.mission.items.find((i: { command: number }) => i.command === 177);
    expect(jump.params[0]).toBe(4);
    expect(doc.mission.items[3].command).toBe(19);
  });
  it('.waypoints', async () => {
    const out = buildWaypointsFile(golden());
    await expect(out).toMatchFileSnapshot('golden/mission.waypoints');
    expect(out.split('\r\n')[0]).toBe('QGC WPL 110');
    expect(out.split('\r\n')[1]).toBe('0\t1\t0\t16\t0\t0\t0\t0\t47\t8\t420\t1');
  });
  it('kml, geojson, csv, mps json', async () => {
    await expect(buildKml(golden(), ZONES)).toMatchFileSnapshot('golden/mission.kml');
    await expect(buildGeoJson(golden(), ZONES)).toMatchFileSnapshot('golden/mission.geojson');
    await expect(buildCsv(golden())).toMatchFileSnapshot('golden/mission.csv');
    await expect(buildMpsJson(golden(), { zones: ZONES, now: NOW })).toMatchFileSnapshot('golden/mission.mps.json');
    expect(JSON.parse(buildMpsJson(golden(), { now: NOW })).version).toBe('1.0');
  });
});

describe('round trips', () => {
  it('.plan keeps items, speeds, DO_JUMP targets, home, zones and rally points', () => {
    const m = golden();
    const back = parsePlan(buildQgcPlan(m, { zones: ZONES, rallyPoints: [{ latitude: 47.0005, longitude: 8.0005, altitude: 30 }] }));
    expect(shape(back.items)).toEqual(shape(m.items));
    expect(back.homePosition).toEqual(m.homePosition);
    expect(back.zones.map((z) => [z.kind, z.shape])).toEqual([['keep_out', 'polygon'], ['keep_in', 'polygon'], ['keep_out', 'circle']]);
    expect(back.zones[0].vertices).toEqual(ZONES[0].vertices);
    expect(back.rallyPoints).toEqual([{ latitude: 47.0005, longitude: 8.0005, altitude: 30 }]);
    expect(back.warnings).toEqual([]);
  });
  it('.waypoints', () => {
    const m = golden();
    const back = parseWaypoints(buildWaypointsFile(m));
    expect(shape(back.items)).toEqual(shape(m.items));
    expect(back.homePosition).toEqual(m.homePosition);
  });
  it('MPS JSON keeps ids, notes and zones', () => {
    const m = golden();
    const back = parseMpsJson(buildMpsJson(m, { zones: ZONES, now: NOW }));
    expect(shape(back.items)).toEqual(shape(m.items));
    expect(back.items.map((i) => i.id)).toEqual(m.items.map((i) => i.id));
    expect(back.items[2].notes).toBe('orbit, "tower"');
    expect(back.zones).toEqual(ZONES);
    expect(back.name).toBe('Golden Field #1');
  });
  it('parseMissionFile detects formats and rejects junk', () => {
    const m = golden();
    expect(parseMissionFile('x.plan', buildQgcPlan(m)).items).toHaveLength(m.items.length);
    expect(parseMissionFile('x.waypoints', buildWaypointsFile(m)).items).toHaveLength(m.items.length);
    expect(parseMissionFile('x.json', buildMpsJson(m)).items).toHaveLength(m.items.length);
    expect(() => parseMissionFile('x.bin', 'garbage')).toThrow();
    expect(() => parsePlan('{"fileType":"Other"}')).toThrow();
  });
  it('skips unsupported commands with a warning', () => {
    const text = 'QGC WPL 110\r\n0\t1\t0\t16\t0\t0\t0\t0\t47\t8\t0\t1\r\n1\t0\t3\t999\t0\t0\t0\t0\t0\t0\t0\t1\r\n2\t0\t3\t16\t0\t2\t0\t0\t47.1\t8.1\t50\t1\r\n';
    const r = parseWaypoints(text);
    expect(r.items).toHaveLength(1);
    expect(r.warnings[0]).toMatch(/unsupported command 999/);
  });
});

describe('filenames', () => {
  it('slugs names', () => {
    expect(slugFilename('Golden Field #1', 'plan', NOW)).toBe('golden-field-1_20260115-093000.plan');
    expect(slugFilename('  ***  ', 'kml', NOW)).toBe('mission_20260115-093000.kml');
    expect(slugFilename('a'.repeat(200), 'csv', NOW).length).toBe(80 + '_20260115-093000.csv'.length);
    expect(exportMissionFile(golden(), 'mps', { now: NOW }).filename).toBe('golden-field-1_20260115-093000.json');
  });
});
