import { haversineDistance, clamp } from '@/lib/utils';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import type { MissionItem } from '@/types/mission';
import type { ConstraintConfig, NoFlyZone } from '@/lib/store/constraints-store';

export interface RiskBreakdown {
  distanceScore: number;
  nfzScore: number;
  altScore: number;
  violationScore: number;
  total: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SegmentRisk {
  fromIdx: number;
  toIdx: number;
  color: string;
}

function totalDistance(items: MissionItem[]): number {
  const spatial = items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  );
  let d = 0;
  for (let i = 1; i < spatial.length; i++) {
    d += haversineDistance(
      spatial[i - 1].latitude!,
      spatial[i - 1].longitude!,
      spatial[i].latitude!,
      spatial[i].longitude!
    );
  }
  return d;
}

function minNfzClearance(items: MissionItem[], nfzs: NoFlyZone[]): number {
  if (nfzs.length === 0) return Infinity;
  let min = Infinity;
  for (const item of items) {
    if (!supportsCoordinates(item.action) || item.latitude === null || item.longitude === null) {
      continue;
    }
    for (const nfz of nfzs) {
      const d =
        haversineDistance(item.latitude!, item.longitude!, nfz.latitude, nfz.longitude) -
        nfz.radiusM;
      if (d < min) min = d;
    }
  }
  return min;
}

function maxAltitude(items: MissionItem[]): number {
  let max = 0;
  for (const item of items) {
    if (item.altitude !== null && item.altitude > max) max = item.altitude;
  }
  return max;
}

export function computeViolationCount(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[],
  totalDist: number
): number {
  let count = 0;
  if (totalDist > config.maxDistanceM) count++;
  if (maxAltitude(items) > config.maxAltM) count++;

  for (const item of items) {
    if (
      supportsCoordinates(item.action) &&
      item.altitude !== null &&
      item.altitude < config.minAltM
    ) {
      count++;
      break;
    }
  }

  for (const item of items) {
    if (!supportsCoordinates(item.action) || item.latitude === null || item.longitude === null) {
      continue;
    }
    for (const nfz of nfzs) {
      const d = haversineDistance(item.latitude!, item.longitude!, nfz.latitude, nfz.longitude);
      if (d < nfz.radiusM) {
        count++;
        break;
      }
    }
  }

  return count;
}

export function computeRiskScore(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[]
): RiskBreakdown {
  const totalDist = totalDistance(items);
  const distanceScore = clamp(totalDist / config.maxDistanceM, 0, 1) * 40;

  const clearance = minNfzClearance(items, nfzs);
  const nfzScore =
    nfzs.length === 0
      ? 0
      : (1 - clamp(clearance / 500, 0, 1)) * 30;

  const maxAlt = maxAltitude(items);
  const altScore = clamp(maxAlt / config.maxAltM, 0, 1) * 20;

  const violations = computeViolationCount(items, config, nfzs, totalDist);
  const violationScore = Math.min(violations * 5, 10);

  const total = distanceScore + nfzScore + altScore + violationScore;

  const level: 'LOW' | 'MEDIUM' | 'HIGH' =
    total <= 30 ? 'LOW' : total <= 60 ? 'MEDIUM' : 'HIGH';

  return {
    distanceScore: Math.round(distanceScore * 10) / 10,
    nfzScore: Math.round(nfzScore * 10) / 10,
    altScore: Math.round(altScore * 10) / 10,
    violationScore,
    total: Math.round(total * 10) / 10,
    level,
  };
}

export function computeSegmentRisks(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[],
  accentColor: string = '#00ff41'
): SegmentRisk[] {
  const spatial = items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  );
  const segments: SegmentRisk[] = [];

  for (let i = 0; i < spatial.length - 1; i++) {
    const midLat = ((spatial[i].latitude!) + (spatial[i + 1].latitude!)) / 2;
    const midLng = ((spatial[i].longitude!) + (spatial[i + 1].longitude!)) / 2;
    const midAlt = ((spatial[i].altitude ?? 0) + (spatial[i + 1].altitude ?? 0)) / 2;

    let color = accentColor;

    if (midAlt > config.maxAltM) {
      color = '#ffaa00';
    }

    if (nfzs.length > 0) {
      const minD = Math.min(
        ...nfzs.map((nfz) =>
          haversineDistance(midLat, midLng, nfz.latitude, nfz.longitude) - nfz.radiusM
        )
      );
      if (minD < 500) {
        color = '#ff3333';
      }
    }

    segments.push({ fromIdx: i, toIdx: i + 1, color });
  }

  return segments;
}
