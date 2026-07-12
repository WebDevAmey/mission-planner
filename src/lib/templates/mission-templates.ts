import { PlannerAction, MavlinkFrame, getMissionCommandDefinition } from '@/lib/mavlink/commands';
import type { MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';
import { v4 as uuidv4 } from 'uuid';

const EARTH_RADIUS_M = 6371000;

export interface MissionItemTemplate {
  action: PlannerAction;
  /** Offset in metres from home: [north, east] */
  offsetM: [number, number];
  altM: number;
  speedMs?: number;
  param1?: number;
  param2?: number;
  param3?: number;
  param4?: number;
}

export interface MissionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  items: MissionItemTemplate[];
}

function offsetToLatLng(
  homeLat: number,
  homeLng: number,
  northM: number,
  eastM: number
): { lat: number; lng: number } {
  const lat = homeLat + (northM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lng =
    homeLng +
    (eastM / (EARTH_RADIUS_M * Math.cos((homeLat * Math.PI) / 180))) *
      (180 / Math.PI);
  return { lat: parseFloat(lat.toFixed(7)), lng: parseFloat(lng.toFixed(7)) };
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Mission',
    description: 'Start with a single TAKEOFF item.',
    icon: '✈️',
    tags: ['basic'],
    items: [
      { action: PlannerAction.TAKEOFF, offsetM: [0, 0], altM: 50 },
    ],
  },
  {
    id: 'simple-survey',
    name: 'Simple Survey Grid',
    description: 'A 4-waypoint survey grid at 50 m altitude.',
    icon: '🗺️',
    tags: ['survey', 'autonomous'],
    items: [
      { action: PlannerAction.TAKEOFF, offsetM: [0, 0], altM: 50 },
      { action: PlannerAction.WAYPOINT, offsetM: [100, 0], altM: 50, speedMs: 10 },
      { action: PlannerAction.WAYPOINT, offsetM: [100, 100], altM: 50, speedMs: 10 },
      { action: PlannerAction.WAYPOINT, offsetM: [0, 100], altM: 50, speedMs: 10 },
      { action: PlannerAction.WAYPOINT, offsetM: [0, 0], altM: 50, speedMs: 10 },
      { action: PlannerAction.RTL, offsetM: [0, 0], altM: 0 },
    ],
  },
  {
    id: 'perimeter-patrol',
    name: 'Perimeter Patrol',
    description: 'Patrol a square perimeter then loiter at start.',
    icon: '🔰',
    tags: ['patrol', 'security'],
    items: [
      { action: PlannerAction.TAKEOFF, offsetM: [0, 0], altM: 30 },
      { action: PlannerAction.WAYPOINT, offsetM: [150, 0], altM: 30 },
      { action: PlannerAction.WAYPOINT, offsetM: [150, 150], altM: 30 },
      { action: PlannerAction.WAYPOINT, offsetM: [0, 150], altM: 30 },
      { action: PlannerAction.WAYPOINT, offsetM: [0, 0], altM: 30 },
      { action: PlannerAction.LOITER, offsetM: [0, 0], altM: 30, param1: 30 },
      { action: PlannerAction.RTL, offsetM: [0, 0], altM: 0 },
    ],
  },
  {
    id: 'poi-orbit',
    name: 'Point of Interest Orbit',
    description: 'Fly to a POI and loiter indefinitely.',
    icon: '🎯',
    tags: ['inspection', 'orbit'],
    items: [
      { action: PlannerAction.TAKEOFF, offsetM: [0, 0], altM: 40 },
      { action: PlannerAction.WAYPOINT, offsetM: [200, 0], altM: 40 },
      { action: PlannerAction.LOITER_UNLIM, offsetM: [200, 0], altM: 40, param3: 30 },
      { action: PlannerAction.RTL, offsetM: [0, 0], altM: 0 },
    ],
  },
  {
    id: 'search-rescue',
    name: 'Search and Rescue',
    description: '6-point zigzag search pattern at 60 m with final loiter.',
    icon: '🚨',
    tags: ['sar', 'search', 'rescue'],
    items: [
      { action: PlannerAction.TAKEOFF, offsetM: [0, 0], altM: 60 },
      { action: PlannerAction.WAYPOINT, offsetM: [0, 100], altM: 60 },
      { action: PlannerAction.WAYPOINT, offsetM: [100, 100], altM: 60 },
      { action: PlannerAction.WAYPOINT, offsetM: [100, 0], altM: 60 },
      { action: PlannerAction.WAYPOINT, offsetM: [200, 0], altM: 60 },
      { action: PlannerAction.WAYPOINT, offsetM: [200, 100], altM: 60 },
      { action: PlannerAction.WAYPOINT, offsetM: [300, 100], altM: 60 },
      { action: PlannerAction.LOITER, offsetM: [300, 100], altM: 60, param1: 60 },
      { action: PlannerAction.RTL, offsetM: [0, 0], altM: 0 },
    ],
  },
  {
    id: 'delivery',
    name: 'Delivery Run',
    description: 'Low-altitude delivery with speed and loiter.',
    icon: '📦',
    tags: ['delivery', 'logistics'],
    items: [
      { action: PlannerAction.TAKEOFF, offsetM: [0, 0], altM: 25 },
      { action: PlannerAction.SET_SPEED, offsetM: [0, 0], altM: 0, param2: 8 },
      { action: PlannerAction.WAYPOINT, offsetM: [300, 0], altM: 25 },
      { action: PlannerAction.LOITER, offsetM: [300, 0], altM: 25, param1: 10 },
      { action: PlannerAction.RTL, offsetM: [0, 0], altM: 0 },
    ],
  },
];

export function instantiateTemplate(
  template: MissionTemplate,
  homeLat: number,
  homeLng: number,
  settings: MissionPlanSettings
): MissionItem[] {
  return template.items.map((tmpl, index) => {
    const def = getMissionCommandDefinition(tmpl.action);
    const { lat, lng } = offsetToLatLng(homeLat, homeLng, tmpl.offsetM[0], tmpl.offsetM[1]);

    const params = def.defaultParameters({
      altitude: settings.defaultAltitude,
      speed: settings.defaultSpeed,
      loiterTime: settings.defaultLoiterTime,
      waitTime: settings.defaultWaitTime,
    });

    if (tmpl.param1 !== undefined) params.param1 = tmpl.param1;
    if (tmpl.param2 !== undefined) params.param2 = tmpl.param2;
    if (tmpl.param3 !== undefined) params.param3 = tmpl.param3;
    if (tmpl.param4 !== undefined) params.param4 = tmpl.param4;

    if (def.supportsCoordinates) {
      params.param5 = lat;
      params.param6 = lng;
    }
    if (def.supportsAltitude) {
      params.param7 = tmpl.altM;
    }

    const item: MissionItem = {
      id: uuidv4(),
      sequence: index,
      action: tmpl.action,
      command: def.command,
      frame: MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
      name: def.label,
      parameters: params,
      latitude: def.supportsCoordinates ? lat : null,
      longitude: def.supportsCoordinates ? lng : null,
      altitude: def.supportsAltitude ? tmpl.altM : null,
      speed: tmpl.speedMs,
    };

    return item;
  });
}

export function createMissionFromTemplate(
  template: MissionTemplate,
  homeLat: number,
  homeLng: number,
  settings: MissionPlanSettings,
  missionName?: string
): Omit<MissionPlan, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: missionName ?? template.name,
    items: instantiateTemplate(template, homeLat, homeLng, settings),
    settings,
    homePosition: { latitude: homeLat, longitude: homeLng, altitude: 0 },
  };
}
