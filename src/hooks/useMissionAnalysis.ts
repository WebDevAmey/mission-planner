'use client';

import { useMemo } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { computeMissionMetrics, type MissionMetrics } from '@/lib/domain/metrics';
import {
  computeRisk,
  errorCount,
  validateMission,
  warningCount,
  type Issue,
  type MissionLimits as DomainLimits,
  type RiskScore,
} from '@/lib/domain/validate';
import type { EditorMission } from '@/lib/store/editor-types';

export interface MissionAnalysis {
  metrics: MissionMetrics;
  issues: Issue[];
  errors: number;
  warnings: number;
  risk: RiskScore;
}

/** Editor limits (DB column names) -> validator limits. */
export function toDomainLimits(mission: EditorMission): DomainLimits {
  const settings = mission.settings;
  return {
    maxDistanceM: mission.limits.maxDistanceM,
    maxAltM: mission.limits.maxAltM,
    minAltM: mission.limits.minAltM,
    maxSpeedMs: mission.limits.maxSpeedMs,
    minAglM: mission.limits.minAGLClearance,
    ratedEnduranceS: settings.ratedEnduranceS ?? null,
  };
}

/** Pure analysis of a mission document: metrics, unified issues, risk. */
export function analyseMission(mission: EditorMission, terrain?: { itemIds: string[]; aglM: number }[] | null): MissionAnalysis {
  const limits = toDomainLimits(mission);
  const metrics = computeMissionMetrics(mission, { ratedEnduranceS: limits.ratedEnduranceS });
  const issues = validateMission(mission, {
    zones: mission.zones,
    limits,
    terrain: terrain ?? undefined,
    estimatedTimeS: metrics.timeS,
    distanceM: metrics.distanceM,
  });
  const risk = computeRisk(mission, { zones: mission.zones, limits, issues, distanceM: metrics.distanceM });
  return { metrics, issues, errors: errorCount(issues), warnings: warningCount(issues), risk };
}

/** Memoised analysis of the mission open in the editor (null while none is loaded). */
export function useMissionAnalysis(): MissionAnalysis | null {
  const mission = useMissionStore((s) => s.mission);
  const samples = useTerrainStore((s) => s.samples);
  return useMemo(() => (mission ? analyseMission(mission, samples) : null), [mission, samples]);
}
