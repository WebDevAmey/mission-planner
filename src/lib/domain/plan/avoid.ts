import { PlannerAction } from '@/lib/mavlink/commands';
import {
  type LngLat,
  type Vec,
  dist,
  haversineM,
  projectionFor,
  segmentEntersPolygonInterior,
  signedArea,
} from '@/lib/domain/geo';
import { createMissionItem } from '@/lib/domain/items';
import { missionLegs, type Leg } from '@/lib/domain/mission';
import {
  type LocalZone,
  type Zone,
  type Box,
  altitudeOverlaps,
  boxOf,
  circleToPolygon,
  hasGeometry,
  isExclusion,
  pointInLocalZone,
  segmentHitsLocalZone,
  segmentLeavesLocalZone,
  segmentOutsideBox,
  toLocalZone,
  zonePoints,
} from '@/lib/domain/zones';
import type { MissionItem, MissionPlan } from '@/types/mission';
import { remapJumps } from './optimise';

export interface AvoidOptions {
  /** Safety buffer around keep-out zones (and inside keep-in zones), metres. Default 20. */
  marginM?: number;
}

export interface AvoidResult {
  items: MissionItem[];
  insertedIds: string[];
  /** Legs that could not be routed (an end inside a zone, or no path exists). */
  unresolved: { itemIds: string[]; reason: 'endpoint_in_zone' | 'no_path' }[];
  addedM: number;
  changed: boolean;
}

/**
 * Offsets a polygon ring by `d` metres (positive = outward) using mitred vertex normals,
 * with the miter length capped at 3·|d|.
 */
export function offsetPolygon(poly: Vec[], d: number): Vec[] {
  const ccw = signedArea(poly) > 0;
  const n = poly.length;
  return poly.map((p, i) => {
    const prev = poly[(i - 1 + n) % n];
    const next = poly[(i + 1) % n];
    const outward = (a: Vec, b: Vec): Vec => {
      const ex = b.x - a.x;
      const ey = b.y - a.y;
      const l = Math.hypot(ex, ey) || 1;
      // For a CCW ring the outward normal of edge a->b is (ey, -ex).
      return ccw ? { x: ey / l, y: -ex / l } : { x: -ey / l, y: ex / l };
    };
    const n1 = outward(prev, p);
    const n2 = outward(p, next);
    const bx = n1.x + n2.x;
    const by = n1.y + n2.y;
    const bl = Math.hypot(bx, by);
    if (bl < 1e-9) return { x: p.x + n1.x * d, y: p.y + n1.y * d };
    const cosHalf = (n1.x * bx + n1.y * by) / bl;
    const m = Math.min(Math.abs(d) * 3, Math.abs(d) / Math.max(cosHalf, 1e-3));
    return { x: p.x + (bx / bl) * m * Math.sign(d), y: p.y + (by / bl) * m * Math.sign(d) };
  });
}

interface Obstacle {
  zone: LocalZone;
  buffered: Vec[];
  bufferedBox: Box;
}

/** A* over a lazily evaluated visibility graph. Returns the via-points (excluding a and b). */
function shortestPath(a: Vec, b: Vec, nodes: Vec[], visible: (p: Vec, q: Vec) => boolean): Vec[] | null {
  const all = [a, b, ...nodes];
  const g = new Map<number, number>([[0, 0]]);
  const prev = new Map<number, number>();
  const open = new Set([0]);
  const closed = new Set<number>();
  const f = (i: number) => (g.get(i) ?? Infinity) + dist(all[i], b);
  while (open.size) {
    let cur = -1;
    let best = Infinity;
    for (const i of open) if (f(i) < best) [best, cur] = [f(i), i];
    if (cur === 1) {
      const out: Vec[] = [];
      for (let k = prev.get(1); k !== undefined && k !== 0; k = prev.get(k)) out.unshift(all[k]);
      return out;
    }
    open.delete(cur);
    closed.add(cur);
    for (let j = 1; j < all.length; j++) {
      if (closed.has(j) || j === cur) continue;
      const tentative = g.get(cur)! + dist(all[cur], all[j]);
      if (tentative >= (g.get(j) ?? Infinity)) continue;
      if (!visible(all[cur], all[j])) continue;
      g.set(j, tentative);
      prev.set(j, cur);
      open.add(j);
    }
  }
  return null;
}

/**
 * Inserts the fewest/shortest via-points so no leg crosses an enabled keep-out/no-fly zone
 * (buffered by `marginM`) and no leg leaves a keep-in zone. Via-points are WAYPOINTs with
 * `notes: 'generated: avoidance'`. Pure; returns a new item list.
 */
export function avoidZones(mission: MissionPlan, zones: Zone[], opts: AvoidOptions = {}): AvoidResult {
  const margin = Math.max(0, opts.marginM ?? 20);
  const active = zones.filter((z) => z.enabled && hasGeometry(z));
  const legs = missionLegs(mission);
  const none: AvoidResult = { items: mission.items, insertedIds: [], unresolved: [], addedM: 0, changed: false };
  if (active.length === 0 || legs.length === 0) return none;

  const proj = projectionFor([...legs.flatMap((l) => [l.a, l.b]), ...active.flatMap(zonePoints)]);
  const local = active.map((z) => toLocalZone(z, proj));
  const keepIns = local.filter((lz) => !isExclusion(lz.zone));
  const exclusionsAll = local.filter((lz) => isExclusion(lz.zone));
  const buffer = (lz: LocalZone, d: number) =>
    lz.shape === 'circle' ? circleToPolygon(lz.c, Math.max(1, lz.r), d) : offsetPolygon(lz.poly, d);

  const inserts = new Map<number, MissionItem[]>(); // insert before item index
  const insertedIds: string[] = [];
  const unresolved: AvoidResult['unresolved'] = [];
  let addedM = 0;
  const ids = (leg: Leg) => [leg.from?.item.id, leg.to?.item.id].filter((x): x is string => Boolean(x));

  // Buffered outlines depend only on the zone, so build each once, on first use.
  const obstacleCache = new Map<LocalZone, Obstacle>();
  const obstacleFor = (lz: LocalZone): Obstacle => {
    let o = obstacleCache.get(lz);
    if (!o) {
      const buffered = buffer(lz, margin);
      obstacleCache.set(lz, (o = { zone: lz, buffered, bufferedBox: boxOf(buffered) }));
    }
    return o;
  };

  for (const leg of legs) {
    const a = proj.toLocal(leg.a);
    const b = proj.toLocal(leg.b);
    const relevant = exclusionsAll.filter((lz) => altitudeOverlaps(lz.zone, leg.altA, leg.altB));
    const container = keepIns.find((lz) => pointInLocalZone(a, lz) && pointInLocalZone(b, lz));
    // Most legs touch nothing: answer that from the zones alone, without building buffers.
    if (!relevant.some((lz) => segmentHitsLocalZone(a, b, lz)) && !(container && segmentLeavesLocalZone(a, b, container))) {
      continue;
    }
    const obstacles: Obstacle[] = relevant.map(obstacleFor);
    if (obstacles.some((o) => pointInLocalZone(a, o.zone) || pointInLocalZone(b, o.zone))) {
      unresolved.push({ itemIds: ids(leg), reason: 'endpoint_in_zone' });
      continue;
    }

    const inner = container ? buffer(container, -Math.min(margin, 5)) : [];
    const nodes = [...obstacles.flatMap((o) => o.buffered), ...inner].filter(
      (p) => !obstacles.some((o) => pointInLocalZone(p, o.zone)) && (!container || pointInLocalZone(p, container))
    );
    const visible = (p: Vec, q: Vec) =>
      !obstacles.some(
        (o) =>
          segmentHitsLocalZone(p, q, o.zone) ||
          (!segmentOutsideBox(p, q, o.bufferedBox) && segmentEntersPolygonInterior(p, q, o.buffered))
      ) &&
      (!container || !segmentLeavesLocalZone(p, q, container));
    const via = shortestPath(a, b, nodes, visible);
    if (!via) {
      unresolved.push({ itemIds: ids(leg), reason: 'no_path' });
      continue;
    }
    const alt = Math.max(leg.altA, leg.altB);
    const insertBefore = leg.to ? leg.to.index : mission.items.findIndex((i) => i.action === PlannerAction.RTL);
    const created = via.map((v) => {
      const [lng, lat] = proj.toLngLat(v);
      const wp = createMissionItem(PlannerAction.WAYPOINT, 0, mission.settings, { latitude: lat, longitude: lng, altitude: alt });
      wp.notes = 'generated: avoidance';
      insertedIds.push(wp.id);
      return wp;
    });
    const full: LngLat[] = [leg.a, ...via.map(proj.toLngLat), leg.b];
    for (let i = 1; i < full.length; i++) addedM += haversineM(full[i - 1], full[i]);
    addedM -= haversineM(leg.a, leg.b);
    inserts.set(insertBefore, [...(inserts.get(insertBefore) ?? []), ...created]);
  }

  if (insertedIds.length === 0) return { ...none, unresolved };
  const next: MissionItem[] = [];
  mission.items.forEach((it, i) => {
    next.push(...(inserts.get(i) ?? []), it);
  });
  return { items: remapJumps(mission.items, next), insertedIds, unresolved, addedM, changed: true };
}
