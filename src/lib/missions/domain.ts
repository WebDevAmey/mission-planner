import { computeMissionMetrics, type MissionMetrics } from '@/lib/domain/metrics';
import { validateMission, type Issue, type MissionLimits } from '@/lib/domain/validate';
import type { Zone } from '@/lib/domain/zones';
import type { ApiMission } from '@/lib/missions/map';

/**
 * Bridges stored missions to the shared domain layer (src/lib/domain): the
 * same metrics and validator the editor and SENTINEL use, so dashboard
 * counts match what the editor's Checks panel shows.
 */

export function domainZones(mission: ApiMission): Zone[] {
  return mission.zones.map((z) => ({ ...z }));
}

export function domainLimits(mission: ApiMission): MissionLimits {
  return {
    maxDistanceM: mission.limits.maxDistanceM,
    maxAltM: mission.limits.maxAltM,
    minAltM: mission.limits.minAltM,
    maxSpeedMs: mission.limits.maxSpeedMs,
    // Terrain samples are not available server-side, so the AGL check is skipped.
    minAglM: null,
    ratedEnduranceS: mission.settings.ratedEnduranceS,
  };
}

export interface MissionAnalysis {
  metrics: MissionMetrics;
  issues: Issue[];
  errorCount: number;
  warningCount: number;
}

export function analyseMission(mission: ApiMission): MissionAnalysis {
  const metrics = computeMissionMetrics(mission, {
    model: { cruiseSpeedMs: mission.settings.cruiseSpeed || undefined },
    ratedEnduranceS: mission.settings.ratedEnduranceS,
  });
  const issues = validateMission(mission, {
    zones: domainZones(mission),
    limits: domainLimits(mission),
    estimatedTimeS: metrics.timeS,
    distanceM: metrics.distanceM,
  });
  return {
    metrics,
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  };
}
