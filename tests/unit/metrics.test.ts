import { describe, expect, it } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import {
  aglM,
  buildClearanceSamples,
  computeClearanceProfile,
  computeMissionMetrics,
  sampleSpacingM,
  trapezoidTime,
} from '@/lib/domain/metrics';
import { haversineM } from '@/lib/domain/geo';
import { item, plan, sampleMission } from './fixtures';

describe('trapezoidTime', () => {
  it('long leg: d/v + v/a; short leg: triangular', () => {
    expect(trapezoidTime(1000, 10, 2)).toBeCloseTo(105);
    expect(trapezoidTime(16, 10, 2)).toBeCloseTo(2 * Math.sqrt(8));
    expect(trapezoidTime(0, 10, 2)).toBe(0);
  });
});

describe('computeMissionMetrics', () => {
  it('includes home->first and the RTL return leg', () => {
    const m = sampleMission();
    const met = computeMissionMetrics(m);
    const side = haversineM([8, 47], [8, 47.001]);
    const top = haversineM([8, 47.001], [8.0015, 47.001]);
    // takeoff at home: legs T->1 (side), 1->2 (top), 2->3 (side), 3->home (top)
    expect(met.legs).toHaveLength(4);
    expect(met.distanceM).toBeCloseTo(2 * side + 2 * top, 0);
    expect(met.unbounded).toBe(false);
  });

  it('adds dwell, takeoff/land, speed changes and endurance fraction', () => {
    const m = plan([
      item(PlannerAction.TAKEOFF, 47, 8, 30),
      item(PlannerAction.LOITER, 47.001, 8, 30),
      item(PlannerAction.WAIT),
      item(PlannerAction.SET_SPEED, undefined, undefined, undefined, { parameters: { param1: 0, param2: 5, param3: -1, param4: 0, param5: 0, param6: 0, param7: 0 } }),
      item(PlannerAction.WAYPOINT, 47.002, 8, 30),
      item(PlannerAction.LAND, 47.002, 8, 0),
    ]);
    const met = computeMissionMetrics(m, { ratedEnduranceS: 1200 });
    expect(met.dwellS).toBe(30 + 10); // loiter 30s + wait 10s (fixture settings)
    expect(met.takeoffLandS).toBeCloseTo(30 / 3 + 30 / 1.5);
    expect(met.legs[1].speedMs).toBe(5);
    expect(met.enduranceFraction).toBeCloseTo(met.timeS / 1200);
  });
});

describe('terrain clearance', () => {
  it('uses home-relative maths', () => {
    // Site at 1600 m: 50 m above home over flat ground is 50 m AGL, not negative.
    expect(aglM(50, 1600, 1600)).toBe(50);
    expect(aglM(50, 1600, 1580)).toBe(70);
  });

  it('samples every max(30 m, leg/50) along each leg', () => {
    expect(sampleSpacingM(100)).toBe(30);
    expect(sampleSpacingM(5000)).toBe(100);
    const m = sampleMission();
    const samples = buildClearanceSamples(m);
    for (let i = 1; i < samples.length; i++) {
      const gap = samples[i].distanceM - samples[i - 1].distanceM;
      expect(gap).toBeLessThanOrEqual(30 + 1e-6);
      expect(gap).toBeGreaterThan(0);
    }
    const prof = computeClearanceProfile(samples, samples.map(() => 10), 0);
    expect(Math.min(...prof.map((p) => p.aglM))).toBeGreaterThanOrEqual(20);
  });
});
