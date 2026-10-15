import { PlannerAction } from '@/lib/mavlink/commands';
import { haversineM, projectionFor, type LngLat } from '@/lib/domain/geo';
import { hasValidCoords, homeOf, isSpatial } from '@/lib/domain/mission';
import type { MissionItem, MissionPlan } from '@/types/mission';
import { openPathLength, solveOpenPath } from './tsp';

export interface OptimiseOptions {
  /** Items (by id) that must keep their position. */
  lockedIds?: Iterable<string>;
}

export interface OptimiseResult {
  items: MissionItem[];
  originalM: number;
  optimisedM: number;
  savedM: number;
  /** Fraction saved, 0..1. */
  savedFraction: number;
  changed: boolean;
}

/** A spatial item plus the non-spatial commands that precede (and move with) it. */
interface Unit {
  items: MissionItem[];
  pos: LngLat;
  locked: boolean;
}

const isAnchorStart = (i: MissionItem) => i.action === PlannerAction.TAKEOFF;
const isTerminal = (i: MissionItem) => i.action === PlannerAction.RTL || i.action === PlannerAction.LAND;

function pathLength(home: LngLat | null, pts: LngLat[], end: LngLat | null): number {
  const all = [...(home ? [home] : []), ...pts, ...(end ? [end] : [])];
  let d = 0;
  for (let i = 1; i < all.length; i++) d += haversineM(all[i - 1], all[i]);
  return d;
}

/**
 * Reorders the waypoints between takeoff and the terminal RTL/LAND to shorten the route
 * (open TSP path, fixed start, RTL-aware end). Attached non-spatial commands move with
 * the following spatial item, locked items stay in place, DO_JUMP targets are remapped.
 */
export function optimiseRoute(mission: MissionPlan, opts: OptimiseOptions = {}): OptimiseResult {
  const items = mission.items;
  const locked = new Set(opts.lockedIds ?? []);
  const home = homeOf(mission);

  // Head: everything up to and including the first TAKEOFF. Tail: from the first terminal on.
  const takeoffIdx = items.findIndex(isAnchorStart);
  const headEnd = takeoffIdx >= 0 ? takeoffIdx + 1 : 0;
  let tailStart = items.findIndex((it, i) => i >= headEnd && isTerminal(it));
  if (tailStart < 0) tailStart = items.length;

  const head = items.slice(0, headEnd);
  const units: Unit[] = [];
  let pending: MissionItem[] = [];
  for (const it of items.slice(headEnd, tailStart)) {
    pending.push(it);
    if (isSpatial(it) && hasValidCoords(it)) {
      units.push({ items: pending, pos: [it.longitude!, it.latitude!], locked: locked.has(it.id) || pending.some((p) => locked.has(p.id)) });
      pending = [];
    }
  }
  const tail = [...pending, ...items.slice(tailStart)];
  const terminal = items[tailStart];
  const headSpatial = [...head].reverse().find((i) => hasValidCoords(i));
  const start: LngLat | null = headSpatial ? [headSpatial.longitude!, headSpatial.latitude!] : home;
  const end: LngLat | null =
    terminal?.action === PlannerAction.RTL ? home : terminal && hasValidCoords(terminal) ? [terminal.longitude!, terminal.latitude!] : null;

  const originalM = pathLength(start, units.map((u) => u.pos), end);
  if (units.length < 3 || !start) {
    return { items, originalM, optimisedM: originalM, savedM: 0, savedFraction: 0, changed: false };
  }

  const proj = projectionFor([start, ...units.map((u) => u.pos), ...(end ? [end] : [])]);
  // Split into free segments between locked anchors.
  const newUnits: Unit[] = [];
  let segStart = proj.toLocal(start);
  let seg: Unit[] = [];
  const flush = (segEnd: LngLat | null) => {
    if (seg.length > 0) {
      const pts = seg.map((u) => proj.toLocal(u.pos));
      const e = segEnd ? proj.toLocal(segEnd) : null;
      const identity = seg.map((_, i) => i);
      const a = solveOpenPath(segStart, pts, e);
      const b = solveOpenPath(segStart, pts, e, identity);
      const best = openPathLength(segStart, pts, e, a) <= openPathLength(segStart, pts, e, b) ? a : b;
      newUnits.push(...best.map((i) => seg[i]));
    }
    seg = [];
  };
  for (const u of units) {
    if (u.locked) {
      flush(u.pos);
      newUnits.push(u);
      segStart = proj.toLocal(u.pos);
    } else seg.push(u);
  }
  flush(end);

  const optimisedM = pathLength(start, newUnits.map((u) => u.pos), end);
  if (optimisedM >= originalM - 1e-6) {
    return { items, originalM, optimisedM: originalM, savedM: 0, savedFraction: 0, changed: false };
  }
  const reordered = [...head, ...newUnits.flatMap((u) => u.items), ...tail];
  return {
    items: remapJumps(items, reordered),
    originalM,
    optimisedM,
    savedM: originalM - optimisedM,
    savedFraction: originalM > 0 ? (originalM - optimisedM) / originalM : 0,
    changed: true,
  };
}

/**
 * Re-sequences `next` and rewrites DO_JUMP param1 (1-based item index) so each jump still
 * targets the same item id as in `prev`.
 */
export function remapJumps(prev: MissionItem[], next: MissionItem[]): MissionItem[] {
  const newIndex = new Map(next.map((it, i) => [it.id, i]));
  return next.map((it, i) => {
    const out = { ...it, sequence: i };
    if (it.action === PlannerAction.DO_JUMP) {
      const target = prev[Math.round(it.parameters.param1) - 1];
      const ni = target ? newIndex.get(target.id) : undefined;
      if (ni !== undefined) out.parameters = { ...it.parameters, param1: ni + 1 };
    }
    return out;
  });
}

/** Total route length in metres (home -> items -> home on RTL), for previews. */
export function routeLengthM(mission: MissionPlan): number {
  const home = homeOf(mission);
  const pts = mission.items.filter((i) => isSpatial(i) && hasValidCoords(i)).map((i) => [i.longitude!, i.latitude!] as LngLat);
  const rtl = mission.items.some((i) => i.action === PlannerAction.RTL);
  return pathLength(home, pts, rtl ? home : null);
}
