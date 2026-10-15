import { haversineM, lerpLngLat, type LngLat } from '@/lib/domain/geo';
import { homeOf, legItemIds, missionLegs } from '@/lib/domain/mission';
import type { MissionPlan } from '@/types/mission';

/**
 * Height above ground for a home-relative altitude:
 * `agl = relAlt + homeElev - terrainElev` (all metres, elevations above sea level).
 */
export const aglM = (relAltM: number, homeElevM: number, terrainElevM: number): number =>
  relAltM + homeElevM - terrainElevM;

export interface ClearanceSamplePoint {
  pos: LngLat;
  /** Cumulative distance along the route, metres. */
  distanceM: number;
  /** Planned altitude relative to home, interpolated along the leg. */
  relAltM: number;
  /** Item ids of the leg this sample belongs to. */
  itemIds: string[];
}

export interface ClearanceSample extends ClearanceSamplePoint {
  terrainM: number;
  aglM: number;
}

/** Spacing between samples on a leg: every max(30 m, leg/50). */
export const sampleSpacingM = (legM: number): number => Math.max(30, legM / 50);

/**
 * Points along every flown leg where terrain elevation should be looked up, including
 * both leg ends. Feed their positions to an elevation service, then call
 * `computeClearanceProfile`.
 */
export function buildClearanceSamples(mission: MissionPlan): ClearanceSamplePoint[] {
  const out: ClearanceSamplePoint[] = [];
  let cum = 0;
  for (const leg of missionLegs(mission)) {
    const len = haversineM(leg.a, leg.b);
    const n = Math.max(1, Math.ceil(len / sampleSpacingM(len)));
    const ids = legItemIds(leg);
    for (let k = out.length === 0 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      out.push({ pos: lerpLngLat(leg.a, leg.b, t), distanceM: cum + len * t, relAltM: leg.altA + (leg.altB - leg.altA) * t, itemIds: ids });
    }
    cum += len;
  }
  return out;
}

/** Where to look up the home elevation (home, or the first located item). */
export const homeElevationPoint = (mission: MissionPlan): LngLat | null => homeOf(mission);

/** Combine sample points with looked-up terrain elevations. */
export function computeClearanceProfile(
  samples: ClearanceSamplePoint[],
  terrainElevationsM: number[],
  homeElevM: number
): ClearanceSample[] {
  return samples.map((s, i) => {
    const terrainM = terrainElevationsM[i] ?? 0;
    return { ...s, terrainM, aglM: aglM(s.relAltM, homeElevM, terrainM) };
  });
}
