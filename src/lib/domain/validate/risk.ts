import { distPointSegment, distSegmentSegment, projectionFor, type LngLat } from '@/lib/domain/geo';
import { missionLegs } from '@/lib/domain/mission';
import { hasGeometry, isExclusion, segmentBoxGap, toLocalZone, zonePoints, type Zone } from '@/lib/domain/zones';
import type { MissionPlan } from '@/types/mission';
import type { Issue, MissionLimits } from './types';

export interface RiskScore {
  /** 0..100, informational only. */
  total: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  distanceScore: number;
  altScore: number;
  zoneScore: number;
  issueScore: number;
  /** Smallest distance in metres from the flown path to any exclusion zone (Infinity if none). */
  minZoneClearanceM: number;
}

/** Distance (m) at which zone proximity stops adding risk. */
export const RISK_ZONE_HORIZON_M = 500;

/**
 * Informational risk score, never a pass/fail by itself (use `validateMission` issues).
 * Weights:
 * - distance 0–30: total path length / maxDistanceM
 * - altitude 0–20: max altitude / maxAltM
 * - zone proximity 0–30: linear from 0 at >= 500 m clearance to 30 at 0 m
 * - issues 0–20: 10 per error + 2 per warning, capped
 * Levels: LOW <= 30 < MEDIUM <= 60 < HIGH.
 */
export function computeRisk(
  mission: MissionPlan,
  opts: { zones?: Zone[]; limits?: MissionLimits; issues?: Issue[]; distanceM?: number }
): RiskScore {
  const limits = opts.limits ?? {};
  const legs = missionLegs(mission);
  const pathM = opts.distanceM ?? 0;
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const distanceScore = limits.maxDistanceM ? clamp01(pathM / limits.maxDistanceM) * 30 : 0;
  const maxAlt = Math.max(0, ...mission.items.map((i) => i.altitude ?? 0));
  const altScore = limits.maxAltM ? clamp01(maxAlt / limits.maxAltM) * 20 : 0;

  const excl = (opts.zones ?? []).filter((z) => z.enabled && hasGeometry(z) && isExclusion(z));
  let minClear = Infinity;
  if (excl.length > 0 && legs.length > 0) {
    const pts: LngLat[] = [...legs.flatMap((l) => [l.a, l.b]), ...excl.flatMap(zonePoints)];
    const proj = projectionFor(pts);
    const local = excl.map((z) => toLocalZone(z, proj));
    for (const leg of legs) {
      const a = proj.toLocal(leg.a);
      const b = proj.toLocal(leg.b);
      for (const lz of local) {
        // The box gap is a lower bound on this zone's clearance; skip zones that cannot lower the minimum.
        if (segmentBoxGap(a, b, lz.box) - 1e-6 > minClear) continue;
        let d: number;
        if (lz.shape === 'circle') d = Math.max(0, distPointSegment(lz.c, a, b) - lz.r);
        else {
          d = Infinity;
          for (let i = 0, j = lz.poly.length - 1; i < lz.poly.length; j = i++) {
            d = Math.min(d, distSegmentSegment(a, b, lz.poly[j], lz.poly[i]));
          }
        }
        minClear = Math.min(minClear, d);
      }
    }
  }
  const zoneScore = Number.isFinite(minClear) ? (1 - clamp01(minClear / RISK_ZONE_HORIZON_M)) * 30 : 0;
  const issues = opts.issues ?? [];
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const issueScore = Math.min(20, errors * 10 + warnings * 2);
  const total = distanceScore + altScore + zoneScore + issueScore;
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    total: r1(total),
    level: total <= 30 ? 'LOW' : total <= 60 ? 'MEDIUM' : 'HIGH',
    distanceScore: r1(distanceScore),
    altScore: r1(altScore),
    zoneScore: r1(zoneScore),
    issueScore,
    minZoneClearanceM: minClear,
  };
}
