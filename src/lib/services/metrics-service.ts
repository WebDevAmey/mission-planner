import { computeMissionMetrics as computeDomainMetrics, formatDurationShort } from '@/lib/domain/metrics';
import { missionFromItems } from '@/lib/domain/mission';
import { computeRiskScore, computeViolationCount } from '@/lib/services/risk-scorer';
import type { MissionItem, HomePosition } from '@/types/mission';
import type { ConstraintConfig, NoFlyZone } from '@/lib/store/constraints-store';

export interface MissionMetrics {
  totalWaypoints: number;
  spatialWaypoints: number;
  totalDistanceM: number;
  totalDistanceKm: number;
  estimatedFlightTimeSec: number;
  estimatedFlightTimeFormatted: string;
  maxAltitudeM: number;
  minAltitudeM: number;
  avgAltitudeM: number;
  avgSpeedMs: number;
  maxSpeedMs: number;
  batteryEstimate: string;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  constraintViolationCount: number;
  /** Per leg between consecutive located items (home legs excluded), metres. */
  segmentDistances: number[];
  segmentDurations: number[];
}

/**
 * Legacy adapter over `computeMissionMetrics` from `@/lib/domain/metrics`: trapezoidal
 * speed profile, climb/descent, dwell, takeoff/landing and the home/RTL legs.
 */
export function computeMissionMetrics(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[],
  home: HomePosition | null | undefined,
  opts: { ratedEnduranceS?: number | null } = {}
): MissionMetrics {
  const mission = missionFromItems(items, { settings: { defaultSpeed: config.defaultSpeedMs }, homePosition: home ?? null });
  const m = computeDomainMetrics(mission, { ratedEnduranceS: opts.ratedEnduranceS });
  const inner = m.legs.filter((l) => l.itemIds.length === 2);
  const alts = items.filter((i) => i.altitude !== null).map((i) => i.altitude!);
  const speeds = m.legs.map((l) => l.speedMs).filter((s) => s > 0);
  const risk = computeRiskScore(items, config, nfzs);
  return {
    totalWaypoints: items.length,
    spatialWaypoints: m.spatialCount,
    totalDistanceM: m.distanceM,
    totalDistanceKm: m.distanceM / 1000,
    estimatedFlightTimeSec: m.timeS,
    estimatedFlightTimeFormatted: formatDurationShort(m.timeS),
    maxAltitudeM: m.maxAltM,
    minAltitudeM: m.minAltM,
    avgAltitudeM: alts.length ? alts.reduce((a, b) => a + b, 0) / alts.length : 0,
    avgSpeedMs: speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : config.defaultSpeedMs,
    maxSpeedMs: speeds.length ? Math.max(...speeds) : 0,
    batteryEstimate:
      m.enduranceFraction !== null ? `${Math.round(m.enduranceFraction * 100)}% of rated endurance` : `~${formatDurationShort(m.timeS)} flight`,
    riskScore: risk.total,
    riskLevel: risk.level,
    constraintViolationCount: computeViolationCount(items, config, nfzs),
    segmentDistances: inner.map((l) => l.distanceM),
    segmentDurations: inner.map((l) => l.timeS),
  };
}
