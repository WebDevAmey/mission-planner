import { haversineM } from '@/lib/domain/geo';
import { missionLegs } from '@/lib/domain/mission';
import type { Zone } from '@/lib/domain/zones';
import type { MissionPlan } from '@/types/mission';
import { limitIssues, structureIssues } from './structure';
import type { ClearanceSampleInput, Issue, MissionLimits } from './types';
import { zoneIssues } from './zones';

export * from './types';
export { computeRisk, RISK_ZONE_HORIZON_M, type RiskScore } from './risk';
export { structureIssues, limitIssues } from './structure';
export { zoneIssues } from './zones';

export interface ValidateOptions {
  zones?: Zone[];
  limits?: MissionLimits;
  /** Terrain clearance samples (from `computeClearanceProfile`), when terrain data is available. */
  terrain?: ClearanceSampleInput[];
  /** Estimated flight time in seconds (from `computeMissionMetrics`), for the endurance budget. */
  estimatedTimeS?: number;
  /** Path length override; computed from legs when omitted. */
  distanceM?: number;
}

const SEVERITY_ORDER = { error: 0, warning: 1 } as const;

/**
 * The single mission validator (TECHNICAL_SPEC §7.7). Pure and synchronous; returns issues
 * sorted errors-first. Codes are stable and safe to switch on in UI and tests.
 */
export function validateMission(mission: MissionPlan, opts: ValidateOptions = {}): Issue[] {
  const limits = opts.limits ?? {};
  const issues: Issue[] = [...structureIssues(mission)];
  if (mission.items.length === 0) return issues;
  issues.push(...limitIssues(mission, limits));

  const distanceM = opts.distanceM ?? missionLegs(mission).reduce((s, l) => s + haversineM(l.a, l.b), 0);
  if (limits.maxDistanceM != null && distanceM > limits.maxDistanceM) {
    issues.push({
      code: 'DISTANCE_LIMIT',
      severity: 'error',
      message: `Route is ${(distanceM / 1000).toFixed(2)} km, above the ${(limits.maxDistanceM / 1000).toFixed(2)} km limit`,
      itemIds: [],
    });
  }

  issues.push(...zoneIssues(mission, opts.zones ?? []));

  if (opts.terrain && limits.minAglM != null) {
    const minAgl = limits.minAglM;
    const byLeg = new Map<string, number>();
    for (const s of opts.terrain) {
      const key = s.itemIds.join('>');
      byLeg.set(key, Math.min(byLeg.get(key) ?? Infinity, s.aglM));
    }
    for (const [key, agl] of byLeg) {
      if (agl < minAgl) {
        issues.push({
          code: 'TERRAIN_CLEARANCE',
          severity: 'error',
          message: `Terrain clearance drops to ${Math.round(agl)} m, below the ${minAgl} m minimum`,
          itemIds: key ? key.split('>') : [],
        });
      }
    }
  }

  if (opts.estimatedTimeS != null && limits.ratedEnduranceS) {
    const reserve = limits.enduranceReserve ?? 0.8;
    const frac = opts.estimatedTimeS / limits.ratedEnduranceS;
    const mins = (s: number) => `${Math.round(s / 60)} min`;
    if (frac > reserve) {
      issues.push({
        code: 'ENDURANCE_EXCEEDED',
        severity: 'error',
        message: `Estimated ${mins(opts.estimatedTimeS)} uses ${Math.round(frac * 100)}% of the ${mins(limits.ratedEnduranceS)} rated endurance (limit ${Math.round(reserve * 100)}%)`,
        itemIds: [],
      });
    } else if (frac > reserve * 0.85) {
      issues.push({
        code: 'ENDURANCE_HIGH',
        severity: 'warning',
        message: `Estimated ${mins(opts.estimatedTimeS)} uses ${Math.round(frac * 100)}% of rated endurance`,
        itemIds: [],
      });
    }
  }

  return issues
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => SEVERITY_ORDER[a.issue.severity] - SEVERITY_ORDER[b.issue.severity] || a.i - b.i)
    .map(({ issue }) => issue);
}
