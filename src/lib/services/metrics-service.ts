import { haversineDistance } from '@/lib/utils';
import { supportsCoordinates } from '@/lib/mavlink/commands';
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
  segmentDistances: number[];
  segmentDurations: number[];
}

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function batteryEstimate(timeSec: number): string {
  const totalMin = (timeSec / 60) * 1.1;
  const m = Math.floor(totalMin);
  const s = Math.round((totalMin - m) * 60);
  return `~${m}m ${s}s`;
}

export function computeMissionMetrics(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[],
  home: HomePosition | null | undefined
): MissionMetrics {
  const spatial = items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  );

  const altitudes = items
    .filter((i) => i.altitude !== null)
    .map((i) => i.altitude!);

  const maxAltitudeM = altitudes.length > 0 ? Math.max(...altitudes) : 0;
  const minAltitudeM = altitudes.length > 0 ? Math.min(...altitudes) : 0;
  const avgAltitudeM =
    altitudes.length > 0
      ? altitudes.reduce((a, b) => a + b, 0) / altitudes.length
      : 0;

  const segmentDistances: number[] = [];
  const segmentDurations: number[] = [];
  let totalDistanceM = 0;
  let totalTimeSec = 0;
  let totalSpeed = 0;
  let speedCount = 0;
  let maxSpeed = 0;

  for (let i = 1; i < spatial.length; i++) {
    const a = spatial[i - 1];
    const b = spatial[i];
    const d = haversineDistance(a.latitude!, a.longitude!, b.latitude!, b.longitude!);
    const segSpeed = b.speed ?? a.speed ?? config.defaultSpeedMs;
    const effectiveSpeed = segSpeed > 0 ? segSpeed : config.defaultSpeedMs;
    const duration = effectiveSpeed > 0 ? d / effectiveSpeed : 0;

    segmentDistances.push(d);
    segmentDurations.push(duration);
    totalDistanceM += d;
    totalTimeSec += duration;

    if (effectiveSpeed > 0) {
      totalSpeed += effectiveSpeed;
      speedCount++;
    }
    if (effectiveSpeed > maxSpeed) maxSpeed = effectiveSpeed;
  }

  // Add loiter times for LOITER items
  for (const item of items) {
    if (item.action === 'loiter' && item.parameters.param1 > 0) {
      totalTimeSec += item.parameters.param1;
    }
    if (item.action === 'wait' && item.parameters.param1 > 0) {
      totalTimeSec += item.parameters.param1;
    }
  }

  const avgSpeedMs = speedCount > 0 ? totalSpeed / speedCount : config.defaultSpeedMs;
  const risk = computeRiskScore(items, config, nfzs);
  const violationCount = computeViolationCount(items, config, nfzs, totalDistanceM);

  void home;

  return {
    totalWaypoints: items.length,
    spatialWaypoints: spatial.length,
    totalDistanceM,
    totalDistanceKm: totalDistanceM / 1000,
    estimatedFlightTimeSec: totalTimeSec,
    estimatedFlightTimeFormatted: formatMMSS(totalTimeSec),
    maxAltitudeM,
    minAltitudeM,
    avgAltitudeM,
    avgSpeedMs,
    maxSpeedMs: maxSpeed,
    batteryEstimate: batteryEstimate(totalTimeSec),
    riskScore: risk.total,
    riskLevel: risk.level,
    constraintViolationCount: violationCount,
    segmentDistances,
    segmentDurations,
  };
}
