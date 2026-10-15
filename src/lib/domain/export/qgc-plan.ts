import { round1, round7 } from '@/lib/utils';
import { openRing } from '@/lib/domain/geo';
import { hasGeometry, isInclusion, type Zone } from '@/lib/domain/zones';
import type { MissionPlan } from '@/types/mission';
import { buildExportRows } from './rows';

export type VehicleType = 'multirotor' | 'fixed_wing' | 'vtol' | 'rover';

/** MAV_TYPE values used by QGC for `.plan` vehicleType. */
export const MAV_TYPE: Record<VehicleType, number> = { multirotor: 2, fixed_wing: 1, vtol: 20, rover: 10 };
/** MAV_AUTOPILOT_ARDUPILOTMEGA. */
export const FIRMWARE_ARDUPILOT = 3;

export interface RallyPoint {
  latitude: number;
  longitude: number;
  altitude: number;
}

export interface PlanExportOptions {
  zones?: Zone[];
  rallyPoints?: RallyPoint[];
  vehicleType?: VehicleType;
  cruiseSpeed?: number;
  hoverSpeed?: number;
}

/** Planned home as [lat, lng, alt]: home position, else the first located row. */
export function plannedHome(mission: MissionPlan): [number, number, number] {
  const h = mission.homePosition;
  if (h) return [round7(h.latitude), round7(h.longitude), round1(h.altitude)];
  const first = buildExportRows(mission).find((r) => r.latitude !== null && !(r.latitude === 0 && r.longitude === 0));
  return first ? [first.param5, first.param6, first.param7] : [0, 0, 0];
}

export function buildQgcPlanObject(mission: MissionPlan, opts: PlanExportOptions = {}) {
  const rows = buildExportRows(mission);
  const zones = (opts.zones ?? []).filter((z) => z.enabled && hasGeometry(z));
  return {
    fileType: 'Plan',
    geoFence: {
      circles: zones
        .filter((z) => z.shape === 'circle')
        .map((z) => ({
          circle: { center: [round7(z.centerLat!), round7(z.centerLng!)], radius: round1(z.radiusM!) },
          inclusion: isInclusion(z),
          version: 1,
        })),
      polygons: zones
        .filter((z) => z.shape === 'polygon')
        .map((z) => ({
          inclusion: isInclusion(z),
          polygon: openRing(z.vertices ?? []).map(([lng, lat]) => [round7(lat), round7(lng)]),
          version: 1,
        })),
      version: 2,
    },
    groundStation: 'Flight Deck',
    mission: {
      cruiseSpeed: opts.cruiseSpeed ?? mission.settings.defaultSpeed,
      firmwareType: FIRMWARE_ARDUPILOT,
      globalPlanAltitudeMode: 1,
      hoverSpeed: opts.hoverSpeed ?? mission.settings.defaultSpeed,
      items: rows.map((row) => ({
        AMSLAltAboveTerrain: null,
        Altitude: row.param7,
        AltitudeMode: 1,
        autoContinue: row.autocontinue === 1,
        command: row.command,
        doJumpId: row.seq + 1,
        frame: row.frame,
        params: [row.param1, row.param2, row.param3, row.param4, row.param5, row.param6, row.param7],
        type: 'SimpleItem',
      })),
      plannedHomePosition: plannedHome(mission),
      vehicleType: MAV_TYPE[opts.vehicleType ?? 'multirotor'],
      version: 2,
    },
    rallyPoints: {
      points: (opts.rallyPoints ?? []).map((p) => [round7(p.latitude), round7(p.longitude), round1(p.altitude)]),
      version: 2,
    },
    version: 1,
  };
}

/** QGroundControl `.plan` (JSON v1) for ArduPilot. */
export const buildQgcPlan = (mission: MissionPlan, opts: PlanExportOptions = {}): string =>
  JSON.stringify(buildQgcPlanObject(mission, opts), null, 2);
