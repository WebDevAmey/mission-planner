import { z } from 'zod';

const MISSION_ACTIONS = [
  'takeoff',
  'waypoint',
  'loiter',
  'loiter_unlim',
  'loiter_turns',
  'spline_waypoint',
  'rtl',
  'land',
  'wait',
  'condition_distance',
  'set_speed',
  'change_altitude',
  'set_roi',
  'cam_trigg_dist',
  'do_jump',
] as const;

export const MISSION_ACTION_VALUES = MISSION_ACTIONS;
export const MAX_MISSION_ITEMS = 2000;
export const MAX_MISSION_ZONES = 200;

export const waypointInputSchema = z.object({
  id: z.string().min(1).optional(),
  sequence: z.number().int().min(0),
  action: z.enum(MISSION_ACTIONS),
  command: z.number().int(),
  frame: z.number().int(),
  name: z.string().min(1).max(200),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  altitude: z.number().nullable(),
  speed: z.number().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  param1: z.number(),
  param2: z.number(),
  param3: z.number(),
  param4: z.number(),
  param5: z.number(),
  param6: z.number(),
  param7: z.number(),
});

// Range checks live here rather than as DB CHECK constraints (TECHNICAL_SPEC §3.2).
export const missionSettingsInputSchema = z.object({
  defaultAltitude: z.number().positive().max(10000),
  defaultSpeed: z.number().positive().max(200),
  defaultLoiterTime: z.number().nonnegative().max(86400),
  defaultWaitTime: z.number().nonnegative().max(86400),
  altitudeReference: z.literal('relative'),
  cruiseSpeed: z.number().positive().max(200).optional(),
  hoverSpeed: z.number().positive().max(200).optional(),
  turnaroundM: z.number().nonnegative().max(1000).optional(),
  homeElevationM: z.number().min(-500).max(9000).nullable().optional(),
  ratedEnduranceS: z.number().positive().max(7 * 86400).optional(),
});

export const missionLimitsInputSchema = z
  .object({
    maxDistanceM: z.number().positive().max(1_000_000),
    maxAltM: z.number().positive().max(10000),
    minAltM: z.number().nonnegative().max(10000),
    maxSpeedMs: z.number().positive().max(200),
    minAGLClearance: z.number().nonnegative().max(10000),
  })
  .partial()
  .refine((l) => l.minAltM === undefined || l.maxAltM === undefined || l.minAltM <= l.maxAltM, {
    message: 'minAltM must be <= maxAltM',
    path: ['minAltM'],
  });

const lngLat = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

type LngLatTuple = [number, number];

function samePoint(a: LngLatTuple, b: LngLatTuple): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function orient(a: LngLatTuple, b: LngLatTuple, c: LngLatTuple): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

/** Proper (non-adjacent) edge crossings make a polygon self-intersecting. O(n²), n ≤ 500. */
export function polygonSelfIntersects(input: LngLatTuple[]): boolean {
  const ring = input.length > 1 && samePoint(input[0], input[input.length - 1]) ? input.slice(0, -1) : input;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      const c = ring[j];
      const d = ring[(j + 1) % n];
      const d1 = orient(a, b, c);
      const d2 = orient(a, b, d);
      const d3 = orient(c, d, a);
      const d4 = orient(c, d, b);
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
  }
  return false;
}

/** Mirrors `Zone` (TECHNICAL_SPEC §3.2). Polygon vertices are [lng, lat], 3–500 points. */
export const zoneInputSchema = z
  .object({
    id: z.string().min(1).max(100).optional(),
    kind: z.enum(['no_fly', 'keep_in', 'keep_out']),
    shape: z.enum(['circle', 'polygon']),
    label: z.string().trim().max(200).default(''),
    enabled: z.boolean().default(true),
    centerLat: z.number().min(-90).max(90).nullable().optional(),
    centerLng: z.number().min(-180).max(180).nullable().optional(),
    radiusM: z.number().positive().max(100000).nullable().optional(),
    vertices: z.array(lngLat).min(3).max(501).nullable().optional(),
    minAltM: z.number().nullable().optional(),
    maxAltM: z.number().nullable().optional(),
  })
  .superRefine((zone, ctx) => {
    if (zone.shape === 'circle') {
      if (zone.centerLat == null || zone.centerLng == null || zone.radiusM == null) {
        ctx.addIssue({ code: 'custom', message: 'Circle zones need centerLat, centerLng and radiusM' });
      }
    } else {
      const v = zone.vertices ?? [];
      const open = v.length > 1 && samePoint(v[0], v[v.length - 1]) ? v.slice(0, -1) : v;
      if (open.length < 3 || open.length > 500) {
        ctx.addIssue({ code: 'custom', path: ['vertices'], message: 'Polygon zones need 3–500 distinct vertices' });
      } else if (polygonSelfIntersects(open)) {
        ctx.addIssue({ code: 'custom', path: ['vertices'], message: 'Polygon must not self-intersect' });
      }
    }
    if (zone.minAltM != null && zone.maxAltM != null && zone.minAltM > zone.maxAltM) {
      ctx.addIssue({ code: 'custom', path: ['minAltM'], message: 'minAltM must be <= maxAltM' });
    }
  });

export type ZoneInputData = z.infer<typeof zoneInputSchema>;

const homeSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  altitude: z.number().min(-1000).max(10000),
});

export const VEHICLE_TYPES = ['multirotor', 'fixed_wing', 'vtol'] as const;

export const createMissionSchema = z.object({
  name: z.string().trim().min(1, 'Mission name is required').max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  template: z.string().trim().min(1).max(100).optional(),
  home: homeSchema.optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
});

export const listMissionsQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  sort: z.enum(['updated', 'name', 'created']).default('updated'),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
});

export const updateMissionSchema = z.object({
  /** When present and stale the server answers 409 `{ currentVersion }`. */
  baseVersion: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  homePosition: homeSchema.nullable().optional(),
  settings: missionSettingsInputSchema.optional(),
  limits: missionLimitsInputSchema.optional(),
  items: z.array(waypointInputSchema).optional(),
  zones: z.array(zoneInputSchema).max(MAX_MISSION_ZONES).optional(),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
  status: z.enum(['draft', 'ready', 'archived']).optional(),
});
