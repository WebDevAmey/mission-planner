import { PlannerAction, supportsCoordinates } from '@/lib/mavlink/commands';
import type { LngLat } from '@/lib/domain/geo';
import type { MissionItem, MissionPlan } from '@/types/mission';

/** A mission item that has a usable position. */
export interface SpatialPoint {
  item: MissionItem;
  index: number;
  pos: LngLat;
  /** Altitude relative to home, metres. */
  alt: number;
}

export const hasValidCoords = (i: MissionItem): boolean =>
  i.latitude !== null &&
  i.longitude !== null &&
  Number.isFinite(i.latitude) &&
  Number.isFinite(i.longitude) &&
  !(i.latitude === 0 && i.longitude === 0);

/**
 * TAKEOFF without coordinates is legal in ArduPilot (the vehicle climbs where it is),
 * so such an item is treated as located at home rather than missing a position.
 */
export const isTakeoffAtHome = (i: MissionItem): boolean =>
  i.action === PlannerAction.TAKEOFF && !hasValidCoords(i);

export const isSpatial = (i: MissionItem): boolean => supportsCoordinates(i.action);

/** Spatial items with valid coordinates, in mission order. */
export function spatialPoints(items: MissionItem[]): SpatialPoint[] {
  const out: SpatialPoint[] = [];
  items.forEach((item, index) => {
    if (!isSpatial(item) || !hasValidCoords(item)) return;
    out.push({ item, index, pos: [item.longitude!, item.latitude!], alt: item.altitude ?? 0 });
  });
  return out;
}

/** Home position: explicit home, else the first located item. */
export function homeOf(mission: Pick<MissionPlan, 'homePosition' | 'items'>): LngLat | null {
  const h = mission.homePosition;
  if (h && Number.isFinite(h.latitude) && Number.isFinite(h.longitude) && !(h.latitude === 0 && h.longitude === 0)) {
    return [h.longitude, h.latitude];
  }
  const first = spatialPoints(mission.items)[0];
  return first ? first.pos : null;
}

export const endsWithRtl = (items: MissionItem[]): boolean =>
  items.some((i) => i.action === PlannerAction.RTL);

/** One straight leg of the flown path. `from`/`to` are null for the home point. */
export interface Leg {
  from: SpatialPoint | null;
  to: SpatialPoint | null;
  a: LngLat;
  b: LngLat;
  altA: number;
  altB: number;
}

/**
 * Flown path: home -> first located item -> ... -> last located item, plus the return
 * leg to home when the mission contains RTL.
 */
export function missionLegs(mission: Pick<MissionPlan, 'homePosition' | 'items'>): Leg[] {
  const pts = spatialPoints(mission.items);
  const home = homeOf(mission);
  const legs: Leg[] = [];
  if (pts.length === 0) return legs;
  if (home && (home[0] !== pts[0].pos[0] || home[1] !== pts[0].pos[1])) {
    legs.push({ from: null, to: pts[0], a: home, b: pts[0].pos, altA: 0, altB: pts[0].alt });
  }
  for (let i = 1; i < pts.length; i++) {
    legs.push({ from: pts[i - 1], to: pts[i], a: pts[i - 1].pos, b: pts[i].pos, altA: pts[i - 1].alt, altB: pts[i].alt });
  }
  const last = pts[pts.length - 1];
  if (home && endsWithRtl(mission.items)) {
    legs.push({ from: last, to: null, a: last.pos, b: home, altA: last.alt, altB: last.alt });
  }
  return legs;
}

export const legItemIds = (leg: Leg): string[] =>
  [leg.from?.item.id, leg.to?.item.id].filter((x): x is string => Boolean(x));
