import { haversineDistance } from '@/lib/utils';
import { supportsCoordinates, getMissionCommandDefinition, PlannerAction } from '@/lib/mavlink/commands';
import type { MissionItem } from '@/types/mission';
import type { NoFlyZone } from '@/lib/store/constraints-store';

const TERMINAL_ACTIONS = new Set<PlannerAction>([
  PlannerAction.RTL,
  PlannerAction.LAND,
]);
const FIRST_ACTIONS = new Set<PlannerAction>([PlannerAction.TAKEOFF]);
const NON_SPATIAL_ACTIONS = new Set<PlannerAction>([
  PlannerAction.WAIT,
  PlannerAction.SET_SPEED,
  PlannerAction.CONDITION_DISTANCE,
  PlannerAction.DO_JUMP,
  PlannerAction.CAM_TRIGG_DIST,
]);

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

export function optimiseRoute(items: MissionItem[]): OptimiseResult {
  const leaders: MissionItem[] = [];
  const terminals: MissionItem[] = [];
  const spatialMiddle: MissionItem[] = [];
  const nonSpatialPre: Array<{ item: MissionItem; attachedToId: string }> = [];

  let pendingNonSpatial: MissionItem[] = [];

  for (const item of items) {
    const def = getMissionCommandDefinition(item.action);
    if (FIRST_ACTIONS.has(item.action)) {
      for (const ns of pendingNonSpatial) {
        leaders.push(ns);
      }
      pendingNonSpatial = [];
      leaders.push(item);
    } else if (TERMINAL_ACTIONS.has(item.action)) {
      for (const ns of pendingNonSpatial) {
        terminals.push(ns);
      }
      pendingNonSpatial = [];
      terminals.push(item);
    } else if (NON_SPATIAL_ACTIONS.has(item.action) || !def.supportsCoordinates) {
      pendingNonSpatial.push(item);
    } else {
      const attachedTo = item.id;
      for (const ns of pendingNonSpatial) {
        nonSpatialPre.push({ item: ns, attachedToId: attachedTo });
      }
      pendingNonSpatial = [];
      spatialMiddle.push(item);
    }
  }

  for (const ns of pendingNonSpatial) {
    terminals.unshift(ns);
  }

  const original = totalPathDistance([...leaders, ...spatialMiddle, ...terminals]);
  const reordered = greedyNearestNeighbour(spatialMiddle);
  const optimised = totalPathDistance([...leaders, ...reordered, ...terminals]);

  const savedM = original - optimised;
  const alreadyOptimal = Math.abs(savedM) < 1;

  const expandedMiddle: MissionItem[] = [];
  for (const item of reordered) {
    const pre = nonSpatialPre
      .filter((e) => e.attachedToId === item.id)
      .map((e) => e.item);
    expandedMiddle.push(...pre, item);
  }

  return {
    reorderedItems: [...leaders, ...expandedMiddle, ...terminals],
    savedM: Math.max(0, savedM),
    alreadyOptimal,
  };
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

  const routeA = greedyNearestNeighbour(spatialMiddle);
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
