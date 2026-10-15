import { describe, expect, it } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import { computeRisk, validateMission } from '@/lib/domain/validate';
import type { Zone } from '@/lib/domain/zones';
import { item, plan, sampleMission } from './fixtures';

const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

describe('validateMission', () => {
  it('clean mission has no issues', () => {
    expect(validateMission(sampleMission())).toEqual([]);
  });

  it('empty mission', () => {
    expect(codes(validateMission(plan([])))).toEqual(['MISSION_EMPTY']);
  });

  it('flags a leg crossing a keep-out zone with both ends outside', () => {
    const m = plan([
      item(PlannerAction.TAKEOFF, 47.0, 8.0, 30),
      item(PlannerAction.WAYPOINT, 47.0, 8.004, 50),
      item(PlannerAction.LAND, 47.0, 8.004, 0),
    ]);
    const zone: Zone = {
      id: 'z1', kind: 'keep_out', shape: 'polygon', label: 'Tower', enabled: true,
      vertices: [[8.0019, 46.9995], [8.0021, 46.9995], [8.0021, 47.0005], [8.0019, 47.0005]],
    };
    const issues = validateMission(m, { zones: [zone] });
    const cross = issues.find((i) => i.code === 'ZONE_KEEP_OUT_CROSS');
    expect(cross).toBeDefined();
    expect(cross?.itemIds).toEqual([m.items[0].id, m.items[1].id]);
    expect(cross?.zoneId).toBe('z1');
    // Midpoint sampling would also have missed a circle offset from the midpoint:
    const circle: Zone = { id: 'c', kind: 'no_fly', shape: 'circle', label: 'c', enabled: true, centerLat: 47.0001, centerLng: 8.0005, radiusM: 20 };
    expect(codes(validateMission(m, { zones: [circle] }))).toContain('ZONE_NO_FLY_CROSS');
    // Disabled zones and zones above the flight band are ignored.
    expect(codes(validateMission(m, { zones: [{ ...zone, enabled: false }] }))).not.toContain('ZONE_KEEP_OUT_CROSS');
    expect(codes(validateMission(m, { zones: [{ ...zone, minAltM: 200 }] }))).not.toContain('ZONE_KEEP_OUT_CROSS');
  });

  it('keep-in: point outside and leg leaving a concave zone', () => {
    // U-shaped keep-in; leg from left arm to right arm crosses the notch.
    const u: Zone = {
      id: 'k', kind: 'keep_in', shape: 'polygon', label: 'U', enabled: true,
      vertices: [[8.0, 47.0], [8.003, 47.0], [8.003, 47.003], [8.002, 47.003], [8.002, 47.001], [8.001, 47.001], [8.001, 47.003], [8.0, 47.003]],
    };
    const m = plan(
      [
        item(PlannerAction.TAKEOFF),
        item(PlannerAction.WAYPOINT, 47.0025, 8.0005, 50),
        item(PlannerAction.WAYPOINT, 47.0025, 8.0025, 50),
        item(PlannerAction.WAYPOINT, 47.01, 8.01, 50),
        item(PlannerAction.LAND, 47.0005, 8.0005, 0),
      ],
      { homePosition: { latitude: 47.0005, longitude: 8.0005, altitude: 0 } }
    );
    const c = codes(validateMission(m, { zones: [u] }));
    expect(c).toContain('ZONE_KEEP_IN_EXIT');
    expect(c).toContain('ZONE_KEEP_IN_POINT');
  });

  it('limits, DO_JUMP and errors-first ordering', () => {
    const m = plan([
      item(PlannerAction.TAKEOFF, 47.0, 8.0, 30),
      item(PlannerAction.WAYPOINT, 47.001, 8.0, 150, { speed: 30 }),
      item(PlannerAction.DO_JUMP, undefined, undefined, undefined, { parameters: { param1: 9, param2: 1, param3: 0, param4: 0, param5: 0, param6: 0, param7: 0 } }),
      item(PlannerAction.WAYPOINT, 0, 0, 50),
    ]);
    const issues = validateMission(m, { limits: { maxAltM: 120, maxSpeedMs: 15, maxDistanceM: 50 } });
    const c = codes(issues);
    expect(c).toEqual(expect.arrayContaining(['ALT_ABOVE_MAX', 'SPEED_ABOVE_MAX', 'DO_JUMP_TARGET_INVALID', 'MISSING_COORDINATES', 'DISTANCE_LIMIT', 'NO_TERMINAL']));
    expect(issues[issues.length - 1].severity).toBe('warning');
    expect(issues[0].severity).toBe('error');
  });

  it('terrain and endurance inputs', () => {
    const m = sampleMission();
    const c = codes(
      validateMission(m, {
        limits: { minAglM: 30, ratedEnduranceS: 600 },
        terrain: [{ itemIds: [m.items[1].id, m.items[2].id], aglM: 12 }],
        estimatedTimeS: 590,
      })
    );
    expect(c).toEqual(['TERRAIN_CLEARANCE', 'ENDURANCE_EXCEEDED']);
  });

  it('risk score is bounded and informational', () => {
    const m = sampleMission();
    const r = computeRisk(m, { limits: { maxDistanceM: 1000, maxAltM: 100 }, distanceM: 500 });
    expect(r.total).toBeGreaterThan(0);
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.minZoneClearanceM).toBe(Infinity);
  });
});
