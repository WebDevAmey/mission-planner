import { toIsoString } from '@/lib/db/serialize';
import type { MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';
import type { MavlinkFrame, MavlinkMissionCommand, PlannerAction } from '@/lib/mavlink/commands';

// Row shapes returned by the ORM (see repo.ts loadFullMission).
export interface DbWaypoint {
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

export interface DbMissionSettings {
  defaultAltitude: number;
  defaultSpeed: number;
  defaultLoiterTime: number;
  defaultWaitTime: number;
  altitudeReference: string;
  maxDistanceM?: number;
  maxAltM?: number;
  minAltM?: number;
  maxSpeedMs?: number;
  minAGLClearance?: number;
  cruiseSpeed?: number;
  hoverSpeed?: number;
  turnaroundM?: number;
  homeElevationM?: number | null;
  ratedEnduranceS?: number;
}

export interface DbZone {
  id: string;
  kind: string;
  shape: string;
  label: string;
  enabled: boolean;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  vertices: unknown;
  minAltM: number | null;
  maxAltM: number | null;
}

export interface DbMissionCore {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeAltitude: number | null;
  version?: number;
  status?: string;
  vehicleType?: string;
  distanceM?: number | null;
  durationS?: number | null;
  waypointCount?: number | null;
  errorCount?: number | null;
  warningCount?: number | null;
  bboxMinLat?: number | null;
  bboxMinLng?: number | null;
  bboxMaxLat?: number | null;
  bboxMaxLng?: number | null;
}

export interface DbMission extends DbMissionCore {
  waypoints: DbWaypoint[];
  settings: DbMissionSettings | null;
  zones?: DbZone[];
}

export type MissionStatus = 'draft' | 'ready' | 'archived';

/** Settings as returned by the API: the editor's settings plus the extra flight-model fields. */
export interface ApiMissionSettings extends MissionPlanSettings {
  cruiseSpeed: number;
  hoverSpeed: number;
  turnaroundM: number;
  homeElevationM: number | null;
  ratedEnduranceS: number;
}

export interface ApiMissionLimits {
  maxDistanceM: number;
  maxAltM: number;
  minAltM: number;
  maxSpeedMs: number;
  minAGLClearance: number;
}

export interface ApiZone {
  id: string;
  kind: 'no_fly' | 'keep_in' | 'keep_out';
  shape: 'circle' | 'polygon';
  label: string;
  enabled: boolean;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  vertices: [number, number][] | null;
  minAltM: number | null;
  maxAltM: number | null;
}

export interface ApiMissionSummaryFields {
  waypointCount: number;
  distanceM: number | null;
  durationS: number | null;
  errorCount: number | null;
  warningCount: number | null;
  /** [minLng, minLat, maxLng, maxLat] or null when the mission has no positions. */
  bbox: [number, number, number, number] | null;
}

/** Full mission document returned by GET/PATCH/POST mission endpoints. */
export interface ApiMission extends MissionPlan {
  version: number;
  status: MissionStatus;
  vehicleType: string;
  settings: ApiMissionSettings;
  limits: ApiMissionLimits;
  zones: ApiZone[];
  summary: ApiMissionSummaryFields;
}

export const DEFAULT_SETTINGS: ApiMissionSettings = {
  defaultAltitude: 80,
  defaultSpeed: 12,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative',
  cruiseSpeed: 12,
  hoverSpeed: 5,
  turnaroundM: 10,
  homeElevationM: null,
  ratedEnduranceS: 1200,
};

export const DEFAULT_LIMITS: ApiMissionLimits = {
  maxDistanceM: 10000,
  maxAltM: 400,
  minAltM: 10,
  maxSpeedMs: 20,
  minAGLClearance: 30,
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

export function toApiZone(z: DbZone): ApiZone {
  return {
    id: z.id,
    kind: z.kind as ApiZone['kind'],
    shape: z.shape as ApiZone['shape'],
    label: z.label,
    enabled: z.enabled,
    centerLat: z.centerLat,
    centerLng: z.centerLng,
    radiusM: z.radiusM,
    vertices: Array.isArray(z.vertices) ? (z.vertices as [number, number][]) : null,
    minAltM: z.minAltM,
    maxAltM: z.maxAltM,
  };
}

function toSettings(s: DbMissionSettings | null): ApiMissionSettings {
  if (!s) return DEFAULT_SETTINGS;
  return {
    defaultAltitude: s.defaultAltitude,
    defaultSpeed: s.defaultSpeed,
    defaultLoiterTime: s.defaultLoiterTime,
    defaultWaitTime: s.defaultWaitTime,
    altitudeReference: 'relative',
    cruiseSpeed: s.cruiseSpeed ?? DEFAULT_SETTINGS.cruiseSpeed,
    hoverSpeed: s.hoverSpeed ?? DEFAULT_SETTINGS.hoverSpeed,
    turnaroundM: s.turnaroundM ?? DEFAULT_SETTINGS.turnaroundM,
    homeElevationM: s.homeElevationM ?? null,
    ratedEnduranceS: s.ratedEnduranceS ?? DEFAULT_SETTINGS.ratedEnduranceS,
  };
}

function toLimits(s: DbMissionSettings | null): ApiMissionLimits {
  return {
    maxDistanceM: s?.maxDistanceM ?? DEFAULT_LIMITS.maxDistanceM,
    maxAltM: s?.maxAltM ?? DEFAULT_LIMITS.maxAltM,
    minAltM: s?.minAltM ?? DEFAULT_LIMITS.minAltM,
    maxSpeedMs: s?.maxSpeedMs ?? DEFAULT_LIMITS.maxSpeedMs,
    minAGLClearance: s?.minAGLClearance ?? DEFAULT_LIMITS.minAGLClearance,
  };
}

function toHome(m: DbMissionCore): MissionPlan['homePosition'] {
  return m.homeLatitude !== null && m.homeLongitude !== null
    ? { latitude: m.homeLatitude, longitude: m.homeLongitude, altitude: m.homeAltitude ?? 0 }
    : null;
}

function toSummaryFields(m: DbMissionCore, fallbackCount: number): ApiMissionSummaryFields {
  const hasBbox = m.bboxMinLat != null && m.bboxMinLng != null && m.bboxMaxLat != null && m.bboxMaxLng != null;
  return {
    waypointCount: m.waypointCount ?? fallbackCount,
    distanceM: m.distanceM ?? null,
    durationS: m.durationS ?? null,
    errorCount: m.errorCount ?? null,
    warningCount: m.warningCount ?? null,
    bbox: hasBbox ? [m.bboxMinLng!, m.bboxMinLat!, m.bboxMaxLng!, m.bboxMaxLat!] : null,
  };
}

export function toMissionPlan(mission: DbMission): ApiMission {
  return {
    id: mission.id,
    name: mission.name,
    description: mission.description ?? undefined,
    createdAt: toIsoString(mission.createdAt),
    updatedAt: toIsoString(mission.updatedAt),
    version: mission.version ?? 1,
    status: (mission.status ?? 'draft') as MissionStatus,
    vehicleType: mission.vehicleType ?? 'multirotor',
    items: [...mission.waypoints].sort((a, b) => a.sequence - b.sequence).map(toMissionItem),
    settings: toSettings(mission.settings),
    limits: toLimits(mission.settings),
    zones: (mission.zones ?? []).map(toApiZone),
    homePosition: toHome(mission),
    summary: toSummaryFields(mission, mission.waypoints.length),
  };
}

/** Dashboard list row — no waypoints loaded. */
export interface MissionSummary extends ApiMissionSummaryFields {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: MissionStatus;
  vehicleType: string;
  homePosition: MissionPlan['homePosition'];
}

export function toMissionSummary(mission: DbMissionCore): MissionSummary {
  return {
    id: mission.id,
    name: mission.name,
    description: mission.description,
    createdAt: toIsoString(mission.createdAt),
    updatedAt: toIsoString(mission.updatedAt),
    version: mission.version ?? 1,
    status: (mission.status ?? 'draft') as MissionStatus,
    vehicleType: mission.vehicleType ?? 'multirotor',
    homePosition: toHome(mission),
    ...toSummaryFields(mission, 0),
  };
}
