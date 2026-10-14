import { toIsoString } from '@/lib/db/serialize';
import type { MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';
import type { MavlinkFrame, MavlinkMissionCommand, PlannerAction } from '@/lib/mavlink/commands';

// Shapes returned by db.orm.public.Mission.include('waypoints', ...).include('settings', ...).first()
interface DbWaypoint {
  id: string;
  sequence: number;
  action: string;
  command: number;
  frame: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  notes: string | null;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  param5: number;
  param6: number;
  param7: number;
}

interface DbMissionSettings {
  defaultAltitude: number;
  defaultSpeed: number;
  defaultLoiterTime: number;
  defaultWaitTime: number;
  altitudeReference: string;
}

interface DbMission {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeAltitude: number | null;
  waypoints: DbWaypoint[];
  settings: DbMissionSettings | null;
}

const DEFAULT_SETTINGS: MissionPlanSettings = {
  defaultAltitude: 80,
  defaultSpeed: 12,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative',
};

export function toMissionItem(wp: DbWaypoint): MissionItem {
  return {
    id: wp.id,
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

export function toMissionPlan(mission: DbMission): MissionPlan {
  return {
    id: mission.id,
    name: mission.name,
    description: mission.description ?? undefined,
    createdAt: toIsoString(mission.createdAt),
    updatedAt: toIsoString(mission.updatedAt),
    items: [...mission.waypoints].sort((a, b) => a.sequence - b.sequence).map(toMissionItem),
    settings: mission.settings
      ? {
          defaultAltitude: mission.settings.defaultAltitude,
          defaultSpeed: mission.settings.defaultSpeed,
          defaultLoiterTime: mission.settings.defaultLoiterTime,
          defaultWaitTime: mission.settings.defaultWaitTime,
          altitudeReference: 'relative',
        }
      : DEFAULT_SETTINGS,
    homePosition:
      mission.homeLatitude !== null && mission.homeLongitude !== null
        ? {
            latitude: mission.homeLatitude,
            longitude: mission.homeLongitude,
            altitude: mission.homeAltitude ?? 0,
          }
        : null,
  };
}

export interface MissionSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  waypointCount: number;
  homePosition: MissionPlan['homePosition'];
}

export function toMissionSummary(
  mission: Omit<DbMission, 'settings' | 'waypoints'> & { waypoints: { id: string }[] }
): MissionSummary {
  return {
    id: mission.id,
    name: mission.name,
    description: mission.description,
    createdAt: toIsoString(mission.createdAt),
    updatedAt: toIsoString(mission.updatedAt),
    waypointCount: mission.waypoints.length,
    homePosition:
      mission.homeLatitude !== null && mission.homeLongitude !== null
        ? {
            latitude: mission.homeLatitude,
            longitude: mission.homeLongitude,
            altitude: mission.homeAltitude ?? 0,
          }
        : null,
  };
}
