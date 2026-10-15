import { haversineDistance } from '@/lib/utils';
import { missionFromItems } from '@/lib/domain/mission';
import { optimiseRoute as optimiseDomainRoute } from '@/lib/domain/plan';
import { supportsCoordinates, PlannerAction } from '@/lib/mavlink/commands';
import type { MissionItem } from '@/types/mission';
import type { NoFlyZone } from '@/lib/store/constraints-store';

const TERMINAL_ACTIONS = new Set<PlannerAction>([
  PlannerAction.RTL,
  PlannerAction.LAND,
]);
const FIRST_ACTIONS = new Set<PlannerAction>([PlannerAction.TAKEOFF]);

function totalPathDistance(items: MissionItem[]): number {
  const spatial = items.filter(
    (i) =>
      supportsCoordinates(i.action) &&
      i.latitude !== null &&
      i.longitude !== null
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

function minNfzClearance(item: MissionItem, nfzs: NoFlyZone[]): number {
  if (!supportsCoordinates(item.action) || item.latitude === null || item.longitude === null) {
    return Infinity;
  }
  if (nfzs.length === 0) return Infinity;
  return Math.min(
    ...nfzs.map(
      (nfz) =>
        haversineDistance(item.latitude!, item.longitude!, nfz.latitude, nfz.longitude) -
        nfz.radiusM
    )
  );
}

function greedyNearestNeighbour(spatial: MissionItem[]): MissionItem[] {
  if (spatial.length <= 1) return [...spatial];
  const remaining = [...spatial];
  const result: MissionItem[] = [];
  let current = remaining.shift()!;
  result.push(current);

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(
        current.latitude!,
        current.longitude!,
        remaining[i].latitude!,
        remaining[i].longitude!
      );
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0];
    result.push(current);
  }
  return result;
}

function maxNfzDistance(spatial: MissionItem[], nfzs: NoFlyZone[]): MissionItem[] {
  if (nfzs.length === 0) return greedyNearestNeighbour(spatial);
  if (spatial.length <= 1) return [...spatial];

  const remaining = [...spatial];
  const result: MissionItem[] = [];
  let current = remaining.shift()!;
  result.push(current);

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestClearance = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c = minNfzClearance(remaining[i], nfzs);
      if (c > bestClearance) {
        bestClearance = c;
        bestIdx = i;
      }
    }
    current = remaining.splice(bestIdx, 1)[0];
    result.push(current);
  }
  return result;
}

interface OptimiseResult {
  reorderedItems: MissionItem[];
  savedM: number;
  alreadyOptimal: boolean;
}

/**
 * Legacy adapter over `optimiseRoute` from `@/lib/domain/plan` (nearest neighbour + 2-opt +
 * Or-opt, fixed start, RTL-aware end, DO_JUMP remapping). Apply as one undo step.
 */
export function optimiseRoute(
  items: MissionItem[],
  home?: { latitude: number; longitude: number; altitude: number } | null
): OptimiseResult {
  const res = optimiseDomainRoute(missionFromItems(items, { homePosition: home ?? null }));
  return { reorderedItems: res.items, savedM: res.savedM, alreadyOptimal: !res.changed || res.savedM < 1 };
}

export function generateAlternativeRoutes(
  items: MissionItem[],
  nfzs: NoFlyZone[],
  defaultSpeedMs: number
): Array<{
  label: string;
  color: string;
  orderedItems: MissionItem[];
  distanceM: number;
  timeS: number;
}> {
  const spatialMiddle = items.filter(
    (i) =>
      !FIRST_ACTIONS.has(i.action) &&
      !TERMINAL_ACTIONS.has(i.action) &&
      supportsCoordinates(i.action) &&
      i.latitude !== null &&
      i.longitude !== null
  );
  const leaders = items.filter((i) => FIRST_ACTIONS.has(i.action));
  const terminals = items.filter((i) => TERMINAL_ACTIONS.has(i.action));

  const optimised = optimiseDomainRoute(missionFromItems(items)).items;
  const routeA = optimised.filter((i) => spatialMiddle.includes(i));
  const routeB = maxNfzDistance(spatialMiddle, nfzs);

  const make = (
    label: string,
    color: string,
    middle: MissionItem[]
  ) => {
    const ordered = [...leaders, ...middle, ...terminals];
    const distanceM = totalPathDistance(ordered);
    const timeS = distanceM / (defaultSpeedMs > 0 ? defaultSpeedMs : 10);
    return { label, color, orderedItems: ordered, distanceM, timeS };
  };

  return [
    make('Route A — Shortest', '#2d7dd2', routeA),
    make('Route B — Max NFZ Distance', '#00cc55', routeB),
  ];
}
