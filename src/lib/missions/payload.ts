import type { z } from 'zod';
import type { MissionItem, MissionPlan } from '@/types/mission';
import type { updateMissionSchema, waypointInputSchema } from '@/lib/validation/mission';
import type { MavlinkFrame, MavlinkMissionCommand, PlannerAction } from '@/lib/mavlink/commands';

export type WaypointInput = z.infer<typeof waypointInputSchema>;
export type MissionPatchBody = z.infer<typeof updateMissionSchema>;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Editor item (nested `parameters`) -> flat API waypoint accepted by `waypointInputSchema`. */
export function toWaypointInput(item: MissionItem, sequence: number): WaypointInput {
  const p = item.parameters ?? ({} as MissionItem['parameters']);
  return {
    id: item.id || undefined,
    sequence,
    action: item.action as WaypointInput['action'],
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

/** Full editor mission -> PATCH /api/missions/:id body. */
export function toMissionPatchBody(mission: MissionPlan): MissionPatchBody {
  return {
    name: mission.name,
    description: mission.description ?? null,
    homePosition: mission.homePosition ?? null,
    settings: mission.settings,
    items: mission.items.map((item, i) => toWaypointInput(item, i)),
  };
}

/** Flat API waypoint -> editor item (inverse of toWaypointInput). */
export function fromWaypointInput(wp: WaypointInput): MissionItem {
  return {
    id: wp.id ?? `wp-${wp.sequence}`,
    sequence: wp.sequence,
    action: wp.action as PlannerAction,
    command: wp.command as MavlinkMissionCommand,
    frame: wp.frame as MavlinkFrame,
    name: wp.name,
    latitude: wp.latitude,
    longitude: wp.longitude,
    altitude: wp.altitude,
    speed: wp.speed ?? undefined,
    notes: wp.notes ?? undefined,
    parameters: {
      param1: wp.param1,
      param2: wp.param2,
      param3: wp.param3,
      param4: wp.param4,
      param5: wp.param5,
      param6: wp.param6,
      param7: wp.param7,
    },
  };
}
