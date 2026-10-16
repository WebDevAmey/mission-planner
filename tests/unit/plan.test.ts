import { describe, expect, it } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import { createProjection, rotate, segmentIntersectsPolygon, type LngLat } from '@/lib/domain/geo';
import { MAX_SURVEY_LINES, avoidZones, generateSurvey, openPathLength, optimiseRoute, routeLengthM, solveOpenPath, surveyToItems } from '@/lib/domain/plan';
import { EXACT_TSP_MAX_POINTS } from '@/lib/domain/plan/tsp';
import { validateMission } from '@/lib/domain/validate';
import type { Zone } from '@/lib/domain/zones';
import { SETTINGS, item, plan } from './fixtures';

const proj = createProjection([8, 47]);
const ll = (x: number, y: number): LngLat => proj.toLngLat({ x, y });

// Deterministic PRNG for property-style tests.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('survey', () => {
  const rect = [ll(0, 0), ll(400, 0), ll(400, 150), ll(0, 150)];

  it('spacing from camera params within ±5% and lines parallel to min-width direction', () => {
    const camera = { sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 8.8 };
    const s = generateSurvey({ polygon: rect, altitudeM: 60, camera, sideOverlap: 0.7, frontOverlap: 0.8 });
    expect(s.spacingM).toBeCloseTo(60 * 1.5 * 0.3, 6);
    expect(s.triggerDistanceM).toBeCloseTo(60 * 0.2, 6);
    // lines run east-west (bearing 90) for a wide rectangle
    expect(Math.abs(s.angleDeg - 90)).toBeLessThan(1e-6);
    const ys = s.lines.map(([a]) => proj.toLocal(a).y);
    for (let i = 1; i < ys.length; i++) {
      expect(Math.abs(Math.abs(ys[i] - ys[i - 1]) - s.spacingM) / s.spacingM).toBeLessThan(0.05);
    }
    expect(s.lineCount).toBe(Math.ceil(150 / s.spacingM));
  });

  it('rotated polygon and explicit angle keep spacing; passes alternate direction', () => {
    for (const rotDeg of [0, 23, 57, 120]) {
      const r = (rotDeg * Math.PI) / 180;
      const poly = [[0, 0], [300, 0], [300, 200], [0, 200]].map(([x, y]) => proj.toLngLat(rotate({ x, y }, r)));
      const s = generateSurvey({ polygon: poly, altitudeM: 50, spacingM: 25, turnaroundM: 10 });
      const local = s.lines.map(([a, b]) => [proj.toLocal(a), proj.toLocal(b)]);
      const dir = { x: local[0][1].x - local[0][0].x, y: local[0][1].y - local[0][0].y };
      const dl = Math.hypot(dir.x, dir.y);
      const nrm = { x: -dir.y / dl, y: dir.x / dl };
      const offs = local.map(([a]) => a.x * nrm.x + a.y * nrm.y);
      for (let i = 1; i < offs.length; i++) expect(Math.abs(Math.abs(offs[i] - offs[i - 1]) - 25)).toBeLessThan(25 * 0.05);
      // alternating direction
      const d1 = local[1][1].x - local[1][0].x;
      const d0 = local[0][1].x - local[0][0].x;
      expect(Math.sign(d0 * d1 + (local[0][1].y - local[0][0].y) * (local[1][1].y - local[1][0].y))).toBe(-1);
    }
  });

  it('handles a concave polygon with split passes', () => {
    const U = [ll(0, 0), ll(300, 0), ll(300, 300), ll(200, 300), ll(200, 100), ll(100, 100), ll(100, 300), ll(0, 300)];
    const s = generateSurvey({ polygon: U, altitudeM: 50, spacingM: 30, angleDeg: 90 });
    expect(s.lines.length).toBeGreaterThan(s.lineCount); // upper scanlines split into 2 intervals
    for (const [a, b] of s.lines) {
      const mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const m = proj.toLocal(mid);
      expect(!(m.x > 100 && m.x < 200 && m.y > 100)).toBe(true); // never through the notch
    }
  });

  it('emits mission items with camera trigger on and off', () => {
    const s = generateSurvey({ polygon: rect, altitudeM: 60, camera: { sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 8.8 } });
    const items = surveyToItems(s, SETTINGS, { altitudeM: 60 });
    expect(items.filter((i) => i.action === PlannerAction.WAYPOINT)).toHaveLength(s.path.length);
    const cams = items.filter((i) => i.action === PlannerAction.CAM_TRIGG_DIST);
    expect(cams.map((c) => c.parameters.param1)).toEqual([Math.round(s.triggerDistanceM! * 100) / 100, 0]);
  });
});

describe('survey limits', () => {
  it('refuses areas that need more passes than a mission can hold, before building them', () => {
    const big = [ll(0, 0), ll(20000, 0), ll(20000, 20000), ll(0, 20000)];
    const t0 = performance.now();
    expect(() => generateSurvey({ polygon: big, altitudeM: 60, spacingM: 1 })).toThrow(/passes/);
    expect(performance.now() - t0).toBeLessThan(50);
    const ok = generateSurvey({ polygon: big, altitudeM: 60, spacingM: 20000 / (MAX_SURVEY_LINES - 1) });
    expect(ok.lineCount).toBeLessThanOrEqual(MAX_SURVEY_LINES);
  });
});

describe('optimiseRoute', () => {
  it('never lengthens the route; keeps takeoff first and RTL last; attached items move with their waypoint', () => {
    const r = rng(42);
    for (let trial = 0; trial < 20; trial++) {
      const wps = Array.from({ length: 4 + Math.floor(r() * 12) }, () => {
        const [lng, lat] = ll(r() * 2000 - 1000, r() * 2000 - 1000);
        return item(PlannerAction.WAYPOINT, lat, lng, 50);
      });
      const speed = item(PlannerAction.SET_SPEED);
      const m = plan([item(PlannerAction.TAKEOFF), ...wps.slice(0, 2), speed, ...wps.slice(2), item(PlannerAction.RTL)]);
      const res = optimiseRoute(m);
      expect(res.optimisedM).toBeLessThanOrEqual(res.originalM + 1e-6);
      expect(routeLengthM({ ...m, items: res.items })).toBeCloseTo(res.optimisedM, 3);
      expect(res.items[0].action).toBe(PlannerAction.TAKEOFF);
      expect(res.items[res.items.length - 1].action).toBe(PlannerAction.RTL);
      expect(res.items).toHaveLength(m.items.length);
      const si = res.items.findIndex((i) => i.id === speed.id);
      expect(res.items[si + 1].id).toBe(wps[2].id);
      res.items.forEach((it, i) => expect(it.sequence).toBe(i));
    }
  });

  it('untangles a crossed route and remaps DO_JUMP targets', () => {
    const a = item(PlannerAction.WAYPOINT, ...latlng(0, 1000));
    const b = item(PlannerAction.WAYPOINT, ...latlng(1000, 0));
    const c = item(PlannerAction.WAYPOINT, ...latlng(1000, 1000));
    const d = item(PlannerAction.WAYPOINT, ...latlng(0, 2000));
    const jump = item(PlannerAction.DO_JUMP, undefined, undefined, undefined, {
      parameters: { param1: 2, param2: 1, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0 },
    });
    const m = plan([item(PlannerAction.TAKEOFF), a, b, c, d, jump, item(PlannerAction.RTL)]);
    const res = optimiseRoute(m);
    expect(res.changed).toBe(true);
    expect(res.savedM).toBeGreaterThan(0);
    const j = res.items.find((i) => i.id === jump.id)!;
    expect(res.items[j.parameters.param1 - 1].id).toBe(a.id);
    expect(validateMission({ ...m, items: res.items }).filter((i) => i.code.startsWith('DO_JUMP'))).toEqual([]);
  });

  it('large inputs use the candidate-list search: fast, a permutation, never longer than the start', () => {
    const r = rng(11);
    const n = 1500;
    expect(n).toBeGreaterThan(EXACT_TSP_MAX_POINTS);
    const pts = Array.from({ length: n }, () => ({ x: r() * 5000, y: r() * 5000 }));
    const s = { x: 0, y: 0 };
    const identity = pts.map((_, i) => i);
    const t0 = performance.now();
    const fromNN = solveOpenPath(s, pts, s);
    const fromIdentity = solveOpenPath(s, pts, s, identity);
    expect(performance.now() - t0).toBeLessThan(5000);
    for (const order of [fromNN, fromIdentity]) {
      expect([...order].sort((a, b) => a - b)).toEqual(identity);
    }
    expect(openPathLength(s, pts, s, fromIdentity)).toBeLessThan(openPathLength(s, pts, s, identity) * 0.2);
    // Random points: a good tour is a small fraction of the random order.
    expect(openPathLength(s, pts, s, fromNN)).toBeLessThan(openPathLength(s, pts, s, identity) * 0.2);
  });

  it('keeps locked items in place', () => {
    const pts = [[0, 1000], [1000, 0], [1000, 1000], [0, 2000]].map(([x, y]) => item(PlannerAction.WAYPOINT, ...latlng(x, y)));
    const m = plan([item(PlannerAction.TAKEOFF), ...pts, item(PlannerAction.RTL)]);
    const res = optimiseRoute(m, { lockedIds: [pts[1].id] });
    expect(res.items[2].id).toBe(pts[1].id);
  });
});

function latlng(x: number, y: number): [number, number, number] {
  const [lng, lat] = ll(x, y);
  return [lat, lng, 50];
}

describe('avoidZones', () => {
  it('routes around keep-out polygons and circles (property)', () => {
    const r = rng(7);
    let inserted = 0;
    for (let trial = 0; trial < 25; trial++) {
      const cx = r() * 400 - 200;
      const cy = r() * 400 - 200;
      const w = 50 + r() * 150;
      const zones: Zone[] = [
        {
          id: 'p', kind: 'keep_out', shape: 'polygon', label: 'P', enabled: true,
          vertices: [ll(cx - w, cy - w / 2), ll(cx + w, cy - w / 2), ll(cx + w, cy + w / 2), ll(cx, cy + w), ll(cx - w, cy + w / 2)],
        },
        { id: 'c', kind: 'no_fly', shape: 'circle', label: 'C', enabled: true, centerLat: ll(cx + 300, cy)[1], centerLng: ll(cx + 300, cy)[0], radiusM: 40 + r() * 60 },
      ];
      const m = plan(
        [
          item(PlannerAction.TAKEOFF),
          item(PlannerAction.WAYPOINT, ...latlng(cx - 600, cy)),
          item(PlannerAction.WAYPOINT, ...latlng(cx + 800, cy + r() * 40)),
          item(PlannerAction.WAYPOINT, ...latlng(cx, cy - 700)),
          item(PlannerAction.LAND, ...latlng(cx, cy + 900)),
        ],
        { homePosition: { latitude: ll(cx - 600, cy - 600)[1], longitude: ll(cx - 600, cy - 600)[0], altitude: 0 } }
      );
      const res = avoidZones(m, zones, { marginM: 15 });
      expect(res.unresolved).toEqual([]);
      inserted += res.insertedIds.length;
      const after = validateMission({ ...m, items: res.items }, { zones });
      expect(after.filter((i) => i.code.startsWith('ZONE_'))).toEqual([]);
      // check every leg geometrically too
      const pts = res.items.filter((i) => i.latitude !== null && !(i.latitude === 0 && i.longitude === 0)).map((i) => proj.toLocal([i.longitude!, i.latitude!]));
      const poly = zones[0].vertices!.map(proj.toLocal);
      for (let i = 1; i < pts.length; i++) expect(segmentIntersectsPolygon(pts[i - 1], pts[i], poly)).toBe(false);
    }
    expect(inserted).toBeGreaterThan(25);
  });

  it('stays inside a concave keep-in zone', () => {
    const U: Zone = {
      id: 'k', kind: 'keep_in', shape: 'polygon', label: 'U', enabled: true,
      vertices: [ll(0, 0), ll(300, 0), ll(300, 300), ll(200, 300), ll(200, 100), ll(100, 100), ll(100, 300), ll(0, 300)],
    };
    const m = plan(
      [item(PlannerAction.TAKEOFF), item(PlannerAction.WAYPOINT, ...latlng(50, 250)), item(PlannerAction.WAYPOINT, ...latlng(250, 250)), item(PlannerAction.LAND, ...latlng(250, 250))],
      { homePosition: { latitude: ll(50, 50)[1], longitude: ll(50, 50)[0], altitude: 0 } }
    );
    expect(validateMission(m, { zones: [U] }).map((i) => i.code)).toContain('ZONE_KEEP_IN_EXIT');
    const res = avoidZones(m, [U], { marginM: 10 });
    expect(res.insertedIds.length).toBeGreaterThanOrEqual(2);
    expect(validateMission({ ...m, items: res.items }, { zones: [U] }).filter((i) => i.code.startsWith('ZONE_'))).toEqual([]);
    expect(res.items.find((i) => i.id === res.insertedIds[0])?.notes).toBe('generated: avoidance');
  });

  it('reports legs whose endpoint is inside a zone', () => {
    const z: Zone = { id: 'c', kind: 'keep_out', shape: 'circle', label: 'C', enabled: true, centerLat: ll(500, 0)[1], centerLng: ll(500, 0)[0], radiusM: 100 };
    const m = plan([item(PlannerAction.TAKEOFF, ...latlng(0, 0)), item(PlannerAction.WAYPOINT, ...latlng(500, 0)), item(PlannerAction.RTL)]);
    const res = avoidZones(m, [z]);
    expect(res.unresolved[0].reason).toBe('endpoint_in_zone');
  });
});
