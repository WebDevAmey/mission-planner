import { projectionFor, type LngLat } from '@/lib/domain/geo';
import { type Leg, legItemIds, missionLegs, spatialPoints } from '@/lib/domain/mission';
import {
  type LocalZone,
  type Zone,
  ZONE_KIND_LABELS,
  altitudeOverlaps,
  hasGeometry,
  isExclusion,
  pointInLocalZone,
  segmentHitsLocalZone,
  segmentLeavesLocalZone,
  toLocalZone,
  zonePoints,
} from '@/lib/domain/zones';
import type { MissionPlan } from '@/types/mission';
import type { Issue, IssueCode } from './types';

const zoneName = (z: Zone) => `${ZONE_KIND_LABELS[z.kind].toLowerCase()} zone "${z.label || 'unnamed'}"`;
const legName = (leg: Leg) =>
  `${leg.from ? `item ${leg.from.index + 1}` : 'home'} → ${leg.to ? `item ${leg.to.index + 1}` : 'home'}`;

/**
 * Zone checks with real segment intersection: a leg crossing a zone is flagged even when
 * both of its ends are outside. Altitude bands on zones are respected.
 */
export function zoneIssues(mission: MissionPlan, zones: Zone[]): Issue[] {
  const active = zones.filter((z) => z.enabled && hasGeometry(z));
  if (active.length === 0) return [];
  const pts = spatialPoints(mission.items);
  const legs = missionLegs(mission);
  const all: LngLat[] = [...pts.map((p) => p.pos), ...legs.flatMap((l) => [l.a, l.b]), ...active.flatMap(zonePoints)];
  const proj = projectionFor(all);
  const local = active.map((z) => toLocalZone(z, proj));
  const exclusions = local.filter((lz) => isExclusion(lz.zone));
  const keepIns = local.filter((lz) => !isExclusion(lz.zone));
  const issues: Issue[] = [];

  for (const p of pts) {
    const v = proj.toLocal(p.pos);
    for (const lz of exclusions) {
      if (altitudeOverlaps(lz.zone, p.alt, p.alt) && pointInLocalZone(v, lz)) {
        const code: IssueCode = lz.zone.kind === 'no_fly' ? 'ZONE_NO_FLY_POINT' : 'ZONE_KEEP_OUT_POINT';
        issues.push({
          code,
          severity: 'error',
          message: `Item ${p.index + 1} (${p.item.name}) is inside ${zoneName(lz.zone)}`,
          itemIds: [p.item.id],
          zoneId: lz.zone.id,
        });
      }
    }
    if (keepIns.length > 0 && !keepIns.some((lz) => pointInLocalZone(v, lz))) {
      issues.push({
        code: 'ZONE_KEEP_IN_POINT',
        severity: 'error',
        message: `Item ${p.index + 1} (${p.item.name}) is outside every keep-in zone`,
        itemIds: [p.item.id],
        zoneId: keepIns[0].zone.id,
      });
    }
  }

  for (const leg of legs) {
    const a = proj.toLocal(leg.a);
    const b = proj.toLocal(leg.b);
    const endsInside = (lz: LocalZone) => pointInLocalZone(a, lz) || pointInLocalZone(b, lz);
    for (const lz of exclusions) {
      if (!altitudeOverlaps(lz.zone, leg.altA, leg.altB)) continue;
      // Endpoints inside are already reported as *_POINT issues.
      if (endsInside(lz) && (leg.from !== null && leg.to !== null)) continue;
      if (segmentHitsLocalZone(a, b, lz)) {
        const code: IssueCode = lz.zone.kind === 'no_fly' ? 'ZONE_NO_FLY_CROSS' : 'ZONE_KEEP_OUT_CROSS';
        issues.push({
          code,
          severity: 'error',
          message: `Leg ${legName(leg)} crosses ${zoneName(lz.zone)}`,
          itemIds: legItemIds(leg),
          zoneId: lz.zone.id,
        });
      }
    }
    if (keepIns.length > 0) {
      const inside = keepIns.filter((lz) => pointInLocalZone(a, lz) && pointInLocalZone(b, lz));
      if (inside.length > 0 && inside.every((lz) => segmentLeavesLocalZone(a, b, lz))) {
        issues.push({
          code: 'ZONE_KEEP_IN_EXIT',
          severity: 'error',
          message: `Leg ${legName(leg)} leaves ${zoneName(inside[0].zone)}`,
          itemIds: legItemIds(leg),
          zoneId: inside[0].zone.id,
        });
      }
    }
  }
  return issues;
}
