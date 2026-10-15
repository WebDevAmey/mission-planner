import { distPointSegment, projectionFor, type LngLat } from '@/lib/domain/geo';
import { missionFromItems, spatialPoints } from '@/lib/domain/mission';
import { computeRisk, limitsFromConstraintConfig, validateMission, type Issue } from '@/lib/domain/validate';
import { fromNoFlyZone } from '@/lib/domain/zones';
import { computeMissionMetrics } from '@/lib/domain/metrics';
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

/** Issue codes that count as constraint violations in the legacy UI. */
const VIOLATION_CODES = new Set<Issue['code']>([
  'DISTANCE_LIMIT',
  'ALT_ABOVE_MAX',
  'ALT_BELOW_MIN',
  'SPEED_ABOVE_MAX',
  'ZONE_NO_FLY_POINT',
  'ZONE_NO_FLY_CROSS',
  'ZONE_KEEP_OUT_POINT',
  'ZONE_KEEP_OUT_CROSS',
  'ZONE_KEEP_IN_POINT',
  'ZONE_KEEP_IN_EXIT',
]);

function constraintIssues(items: MissionItem[], config: ConstraintConfig, nfzs: NoFlyZone[]): Issue[] {
  return validateMission(missionFromItems(items, { settings: { defaultSpeed: config.defaultSpeedMs } }), {
    zones: nfzs.map(fromNoFlyZone),
    limits: limitsFromConstraintConfig(config),
  }).filter((i) => VIOLATION_CODES.has(i.code));
}

/** Number of limit and zone violations (legs are checked by real intersection). */
export function computeViolationCount(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[],
  totalDist?: number
): number {
  void totalDist;
  return constraintIssues(items, config, nfzs).length;
}

/** Legacy adapter over the informational `computeRisk` (see its doc for weights). */
export function computeRiskScore(items: MissionItem[], config: ConstraintConfig, nfzs: NoFlyZone[]): RiskBreakdown {
  const mission = missionFromItems(items, { settings: { defaultSpeed: config.defaultSpeedMs } });
  const issues = constraintIssues(items, config, nfzs);
  const r = computeRisk(mission, {
    zones: nfzs.map(fromNoFlyZone),
    limits: limitsFromConstraintConfig(config),
    issues,
    distanceM: computeMissionMetrics(mission).distanceM,
  });
  return {
    distanceScore: r.distanceScore,
    nfzScore: r.zoneScore,
    altScore: r.altScore,
    violationScore: r.issueScore,
    total: r.total,
    level: r.level,
  };
}

/** Per-leg colour: red within 500 m of a no-fly zone, amber above max altitude. */
export function computeSegmentRisks(
  items: MissionItem[],
  config: ConstraintConfig,
  nfzs: NoFlyZone[],
  accentColor: string = '#00ff41'
): SegmentRisk[] {
  const pts = spatialPoints(items);
  const all: LngLat[] = [...pts.map((p) => p.pos), ...nfzs.map((z) => [z.longitude, z.latitude] as LngLat)];
  const proj = all.length > 0 ? projectionFor(all) : null;
  const segments: SegmentRisk[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    let color = accentColor;
    if (Math.max(pts[i].alt, pts[i + 1].alt) > config.maxAltM) color = '#ffaa00';
    if (proj && nfzs.length > 0) {
      const a = proj.toLocal(pts[i].pos);
      const b = proj.toLocal(pts[i + 1].pos);
      const minD = Math.min(...nfzs.map((z) => distPointSegment(proj.toLocal([z.longitude, z.latitude]), a, b) - z.radiusM));
      if (minD < 500) color = '#ff3333';
    }
    segments.push({ fromIdx: i, toIdx: i + 1, color });
  }
  return segments;
}
