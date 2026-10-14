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

export const missionSettingsInputSchema = z.object({
  defaultAltitude: z.number().positive(),
  defaultSpeed: z.number().positive(),
  defaultLoiterTime: z.number().nonnegative(),
  defaultWaitTime: z.number().nonnegative(),
  altitudeReference: z.literal('relative'),
});

export const createMissionSchema = z.object({
  name: z.string().trim().min(1, 'Mission name is required').max(200),
});

export const updateMissionSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  homePosition: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      altitude: z.number(),
    })
    .nullable()
    .optional(),
  settings: missionSettingsInputSchema.optional(),
  items: z.array(waypointInputSchema).max(2000).optional(),
});
