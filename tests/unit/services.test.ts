import { describe, expect, it, vi } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import { checkGeofences } from '@/lib/services/geofence-checker';
import { computeViolationCount } from '@/lib/services/risk-scorer';
import { computeMissionMetrics } from '@/lib/services/metrics-service';
import { exportMissionAsPlan, missionSanityCheck } from '@/lib/services/mission-builder';
import { optimiseRoute } from '@/lib/services/route-optimizer';
import * as svc from '@/lib/services/terrain-service';
import { getGroundClearance } from '@/lib/services/terrain-service';
import { runSentinelAudit } from '@/lib/agents/sentinel-audit';
import type { MissionDraft } from '@/lib/agents/schemas';
import type { ConstraintConfig } from '@/lib/store/constraints-store';
import { SETTINGS, item, plan, sampleMission } from './fixtures';

const CONFIG: ConstraintConfig = { maxDistanceM: 10000, maxAltM: 120, minAltM: 10, maxSpeedMs: 20, minAGLClearance: 20, defaultSpeedMs: 10 };

const crossing = () => [
  item(PlannerAction.TAKEOFF, 47.0, 8.0, 30),
  item(PlannerAction.WAYPOINT, 47.0, 8.004, 50),
  item(PlannerAction.LAND, 47.0, 8.004, 0),
];

describe('legacy service adapters', () => {
  it('checkGeofences catches a leg crossing with both ends outside', () => {
    const v = checkGeofences(crossing(), [
      { id: 'g', type: 'circle', mode: 'keep-out', label: 'Mast', color: '', enabled: true, center: { lat: 47.0001, lng: 8.0005 }, radiusM: 20 },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ geofenceId: 'g', geofenceLabel: 'Mast', waypointIndex: 1 });
  });

  it('violation count uses segment intersection for no-fly zones', () => {
    const n = computeViolationCount(crossing(), CONFIG, [{ id: 'n', latitude: 47.0001, longitude: 8.0005, radiusM: 20, label: 'x' }]);
    expect(n).toBe(1);
  });

  it('metrics keep legacy shape', () => {
    const m = computeMissionMetrics(sampleMission().items, CONFIG, [], sampleMission().homePosition);
    expect(m.segmentDistances).toHaveLength(3);
    expect(m.estimatedFlightTimeSec).toBeGreaterThan(m.totalDistanceM / 10);
  });

  it('.plan uses ArduPilot firmwareType', () => {
    expect(JSON.parse(exportMissionAsPlan(sampleMission())).mission.firmwareType).toBe(3);
  });

  it('sanity check maps to seq', () => {
    const w = missionSanityCheck(plan([item(PlannerAction.WAYPOINT, 47, 8, 50)]));
    expect(w.map((x) => x.message)).toEqual(['No TAKEOFF item in mission', 'Mission does not end with RTL or LAND']);
    expect(w[1].seq).toBe(0);
  });

  it('optimiseRoute adapter', () => {
    const r = optimiseRoute(sampleMission().items);
    expect(r.savedM).toBeGreaterThanOrEqual(0);
    expect(r.reorderedItems).toHaveLength(5);
  });

  it('ground clearance is home-relative', () => {
    expect(getGroundClearance(50, 1600, 1600)).toBe(50);
  });
});

describe('SENTINEL', () => {
  const draft: MissionDraft = {
    rationale: 'r',
    waypoints: [
      { action: PlannerAction.TAKEOFF, latitude: 47.0, longitude: 8.0, altitude: 30 },
      { action: PlannerAction.WAYPOINT, latitude: 47.0, longitude: 8.004, altitude: 50 },
      { action: PlannerAction.RTL, latitude: null, longitude: null, altitude: null },
    ],
  };
  const flat = async (pts: { lat: number; lng: number }[]) => pts.map(() => 400);

  it('passes a clean mission and vetoes a zone crossing', async () => {
    const base = { settings: SETTINGS, config: CONFIG, homePosition: { latitude: 47, longitude: 8, altitude: 0 }, elevations: flat };
    const ok = await runSentinelAudit(draft, base);
    expect(ok.report.verdict).toBe('PASS');
    const bad = await runSentinelAudit(draft, {
      ...base,
      zones: [{ id: 'z', kind: 'keep_out', shape: 'circle', label: 'Mast', enabled: true, centerLat: 47.0001, centerLng: 8.002, radiusM: 30 }],
    });
    expect(bad.report.verdict).toBe('VETO');
    expect(bad.report.findings.map((f) => f.code)).toContain('ZONE_KEEP_OUT_CROSS');
  });

  it('flags terrain using home-relative clearance', async () => {
    // Ground rises 40 m above home in the middle of the route: 50 m planned -> 10 m AGL.
    const hill = async (pts: { lat: number; lng: number }[]) => pts.map((p, i) => (i === 0 ? 1600 : p.lng > 8.0015 && p.lng < 8.0025 ? 1640 : 1600));
    const r = await runSentinelAudit(draft, { settings: SETTINGS, config: CONFIG, homePosition: { latitude: 47, longitude: 8, altitude: 0 }, elevations: hill });
    expect(r.report.findings.map((f) => f.code)).toContain('TERRAIN_CLEARANCE');
    const down = await runSentinelAudit(draft, { settings: SETTINGS, config: CONFIG, homePosition: null, elevations: async () => { throw new Error('x'); } });
    expect(down.report.findings.map((f) => f.code)).toContain('TERRAIN_UNAVAILABLE');
  });
});

describe('terrain-service elevation cache', () => {
  it('stays bounded and evicts the oldest entries first', async () => {
    svc.clearElevationCache();
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const { locations } = JSON.parse(String(init.body)) as { locations: { latitude: number }[] };
      return new Response(JSON.stringify({ results: locations.map((l) => ({ elevation: l.latitude })) }));
    });
    try {
      const total = svc.ELEVATION_CACHE_MAX + 500;
      const pts = Array.from({ length: total }, (_, i) => ({ lat: i * 1e-4, lng: 0 }));
      expect(await svc.getElevations(pts)).toEqual(pts.map((p) => p.lat));
      expect(svc.elevationCacheSize()).toBe(svc.ELEVATION_CACHE_MAX);
      // The newest point is still cached (no fetch), the oldest was evicted (fetched again).
      let calls = 0;
      vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
        calls++;
        const { locations } = JSON.parse(String(init.body)) as { locations: { latitude: number }[] };
        return new Response(JSON.stringify({ results: locations.map((l) => ({ elevation: l.latitude })) }));
      });
      await svc.getElevations([pts[total - 1]]);
      expect(calls).toBe(0);
      await svc.getElevations([pts[0]]);
      expect(calls).toBe(1);
    } finally {
      vi.unstubAllGlobals();
      svc.clearElevationCache();
    }
  });
});
