import type { MissionItem } from '@/types/mission';
import type { EditorMission } from '@/lib/store/editor-types';

// TODO(core): replace with `toMissionPatchBody` from '@/lib/missions/payload' once
// the core branch lands; this local copy exists so the save fix ships first.

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Editor item (nested `parameters`) -> flat API waypoint (`waypointInputSchema`). */
export function toFlatWaypoint(item: MissionItem, sequence: number) {
  const p = item.parameters ?? ({} as MissionItem['parameters']);
  return {
    id: item.id || undefined,
    sequence,
    action: item.action,
    command: item.command,
    frame: item.frame,
    name: item.name?.trim() ? item.name.slice(0, 200) : String(item.action).toUpperCase(),
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    altitude: item.altitude ?? null,
    speed: item.speed ?? null,
    notes: item.notes ?? null,
    param1: num(p.param1),
    param2: num(p.param2),
    param3: num(p.param3),
    param4: num(p.param4),
    param5: num(p.param5),
    param6: num(p.param6),
    param7: num(p.param7),
  };
}

/** Whole editor document -> PATCH /api/missions/:id body. Zones, limits and
 * baseVersion are ignored by servers that don't support them yet. */
export function buildMissionPatch(mission: EditorMission, baseVersion: number | null) {
  return {
    ...(baseVersion !== null && { baseVersion }),
    name: mission.name,
    description: mission.description ?? null,
    homePosition: mission.homePosition ?? null,
    settings: mission.settings,
    limits: mission.limits,
    zones: mission.zones,
    items: mission.items.map((item, i) => toFlatWaypoint(item, i)),
  };
}
