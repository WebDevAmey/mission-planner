import { db } from '@/prisma/db';
import { toIsoString } from '@/lib/db/serialize';
import type { z } from 'zod';
import type {
  createMissionSchema,
  missionLimitsInputSchema,
  missionSettingsInputSchema,
  updateMissionSchema,
  waypointInputSchema,
  ZoneInputData,
} from '@/lib/validation/mission';
import { computeMissionSummary } from '@/lib/missions/summary';
import type { DbMission } from '@/lib/missions/map';

/**
 * The single place mission rows are read and written. Every handler goes
 * through `getOwnedMission` / `getOwnedFullMission`, so an ownership check
 * can't be forgotten (TECHNICAL_SPEC §4.2): a mission that exists but belongs
 * to someone else is indistinguishable from one that doesn't exist.
 */

type Db = typeof db;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
type Orm = Db['orm'] | Tx['orm'];

export type WaypointInput = z.infer<typeof waypointInputSchema>;
export type SettingsInput = z.infer<typeof missionSettingsInputSchema>;
export type LimitsInput = z.infer<typeof missionLimitsInputSchema>;
export type MissionPatch = z.infer<typeof updateMissionSchema>;
export type MissionCreate = z.infer<typeof createMissionSchema>;

export class VersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Mission was changed elsewhere');
    this.name = 'VersionConflictError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The bare mission row if it exists and belongs to `userId`, otherwise null. */
export async function getOwnedMission(id: string, userId: string, orm: Orm = db.orm) {
  if (!UUID_RE.test(id)) return null;
  const mission = await orm.public.Mission.where({ id }).first();
  return mission && mission.userId === userId ? mission : null;
}

export async function loadFullMission(id: string, orm: Orm = db.orm) {
  return orm.public.Mission.where({ id })
    .include('waypoints', (w) => w)
    .include('settings', (s) => s)
    .include('zones', (z) => z)
    .first();
}

export async function getOwnedFullMission(id: string, userId: string, orm: Orm = db.orm) {
  if (!UUID_RE.test(id)) return null;
  const mission = await loadFullMission(id, orm);
  return mission && mission.userId === userId ? mission : null;
}

export type FullMission = NonNullable<Awaited<ReturnType<typeof loadFullMission>>>;

/** Flat API waypoints → DB rows. Client ids are ignored (S4); sequence is the array order. */
function waypointRows(missionId: string, items: WaypointInput[]) {
  return items.map((item, index) => ({
    missionId,
    sequence: index,
    action: item.action,
    command: item.command,
    frame: item.frame,
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    altitude: item.altitude,
    speed: item.speed ?? null,
    notes: item.notes ?? null,
    param1: item.param1,
    param2: item.param2,
    param3: item.param3,
    param4: item.param4,
    param5: item.param5,
    param6: item.param6,
    param7: item.param7,
  }));
}

function zoneRows(missionId: string, zones: ZoneInputData[]) {
  return zones.map((z) => ({
    missionId,
    kind: z.kind,
    shape: z.shape,
    label: z.label ?? '',
    enabled: z.enabled ?? true,
    centerLat: z.shape === 'circle' ? (z.centerLat ?? null) : null,
    centerLng: z.shape === 'circle' ? (z.centerLng ?? null) : null,
    radiusM: z.shape === 'circle' ? (z.radiusM ?? null) : null,
    vertices: z.shape === 'polygon' ? (z.vertices ?? null) : null,
    minAltM: z.minAltM ?? null,
    maxAltM: z.maxAltM ?? null,
  }));
}

function settingsColumns(settings?: SettingsInput, limits?: LimitsInput) {
  const out: Record<string, unknown> = {};
  if (settings) {
    const { altitudeReference, ...rest } = settings;
    out.altitudeReference = altitudeReference;
    for (const [k, v] of Object.entries(rest)) if (v !== undefined) out[k] = v;
  }
  if (limits) for (const [k, v] of Object.entries(limits)) if (v !== undefined) out[k] = v;
  return out;
}

async function replaceWaypoints(tx: Tx, missionId: string, items: WaypointInput[]) {
  await tx.orm.public.Waypoint.where({ missionId }).deleteAll();
  if (items.length) await tx.orm.public.Waypoint.createAndCount(waypointRows(missionId, items));
}

async function replaceZones(tx: Tx, missionId: string, zones: ZoneInputData[]) {
  await tx.orm.public.Zone.where({ missionId }).deleteAll();
  if (zones.length) await tx.orm.public.Zone.createAndCount(zoneRows(missionId, zones));
}

/** Recomputes and stores the denormalised summary columns from what's now in the DB. */
export async function refreshSummary(tx: Tx, missionId: string) {
  const full = await loadFullMission(missionId, tx.orm);
  if (!full) return;
  const s = full.settings;
  const summary = computeMissionSummary(
    [...full.waypoints].sort((a, b) => a.sequence - b.sequence),
    {
      defaultSpeed: s?.defaultSpeed ?? 12,
      cruiseSpeed: s?.cruiseSpeed,
      ratedEnduranceS: s?.ratedEnduranceS,
      maxDistanceM: s?.maxDistanceM,
      maxAltM: s?.maxAltM,
      minAltM: s?.minAltM,
      maxSpeedMs: s?.maxSpeedMs,
    },
    full.homeLatitude !== null && full.homeLongitude !== null
      ? { latitude: full.homeLatitude, longitude: full.homeLongitude }
      : null,
    full.zones
  );
  await tx.orm.public.Mission.where({ id: missionId }).update({
    ...summary,
    lastValidatedAt: toIsoString(new Date()),
  });
}

/**
 * Applies a whole-document PATCH in one transaction: optimistic version check
 * (row locked), mission fields, settings + limits upsert, waypoint and zone
 * replacement (multi-row inserts), version + 1, summary recompute.
 * Throws VersionConflictError when `baseVersion` is stale.
 */
export async function saveMissionDocument(missionId: string, patch: MissionPatch): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx.orm.public.Mission.where({ id: missionId }).forNoKeyUpdate().first();
    if (!current) throw new Error('Mission vanished during save');
    if (patch.baseVersion !== undefined && patch.baseVersion !== current.version) {
      throw new VersionConflictError(current.version);
    }

    const update: Record<string, unknown> = {
      version: current.version + 1,
      updatedAt: toIsoString(new Date()),
    };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.vehicleType !== undefined) update.vehicleType = patch.vehicleType;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.homePosition !== undefined) {
      update.homeLatitude = patch.homePosition?.latitude ?? null;
      update.homeLongitude = patch.homePosition?.longitude ?? null;
      update.homeAltitude = patch.homePosition?.altitude ?? null;
    }
    await tx.orm.public.Mission.where({ id: missionId }).update(update);

    const cols = settingsColumns(patch.settings, patch.limits);
    if (Object.keys(cols).length) {
      await tx.orm.public.MissionSettings.where({ missionId }).upsert({
        create: { missionId, ...cols },
        update: cols,
      });
    }

    if (patch.items) await replaceWaypoints(tx, missionId, patch.items);
    if (patch.zones) await replaceZones(tx, missionId, patch.zones);

    await refreshSummary(tx, missionId);
  });
}

export interface NewMissionDocument {
  name: string;
  description?: string | null;
  vehicleType?: string;
  status?: 'draft' | 'ready' | 'archived';
  home?: { latitude: number; longitude: number; altitude: number } | null;
  settings?: SettingsInput;
  limits?: LimitsInput;
  items?: WaypointInput[];
  zones?: ZoneInputData[];
}

/** Creates a mission with its settings, items and zones in one transaction; returns the new id. */
export async function createMissionDocument(userId: string, doc: NewMissionDocument): Promise<string> {
  return db.transaction(async (tx) => {
    const mission = await tx.orm.public.Mission.create({
      name: doc.name,
      description: doc.description ?? null,
      userId,
      homeLatitude: doc.home?.latitude ?? null,
      homeLongitude: doc.home?.longitude ?? null,
      homeAltitude: doc.home?.altitude ?? null,
      ...(doc.vehicleType ? { vehicleType: doc.vehicleType } : {}),
      ...(doc.status ? { status: doc.status } : {}),
    });
    await tx.orm.public.MissionSettings.create({ missionId: mission.id, ...settingsColumns(doc.settings, doc.limits) });
    if (doc.items?.length) await tx.orm.public.Waypoint.createAndCount(waypointRows(mission.id, doc.items));
    if (doc.zones?.length) await tx.orm.public.Zone.createAndCount(zoneRows(mission.id, doc.zones));
    await refreshSummary(tx, mission.id);
    return mission.id;
  });
}

/** Copies a mission (settings, limits, waypoints, zones) for `userId`; returns the new id. */
export async function duplicateMission(original: FullMission, userId: string): Promise<string> {
  const s = original.settings;
  return createMissionDocument(userId, {
    name: `${original.name} (Copy)`.slice(0, 200),
    description: original.description,
    vehicleType: original.vehicleType,
    home:
      original.homeLatitude !== null && original.homeLongitude !== null
        ? { latitude: original.homeLatitude, longitude: original.homeLongitude, altitude: original.homeAltitude ?? 0 }
        : null,
    settings: s
      ? {
          defaultAltitude: s.defaultAltitude,
          defaultSpeed: s.defaultSpeed,
          defaultLoiterTime: s.defaultLoiterTime,
          defaultWaitTime: s.defaultWaitTime,
          altitudeReference: 'relative',
          cruiseSpeed: s.cruiseSpeed,
          hoverSpeed: s.hoverSpeed,
          turnaroundM: s.turnaroundM,
          homeElevationM: s.homeElevationM,
          ratedEnduranceS: s.ratedEnduranceS,
        }
      : undefined,
    limits: s
      ? {
          maxDistanceM: s.maxDistanceM,
          maxAltM: s.maxAltM,
          minAltM: s.minAltM,
          maxSpeedMs: s.maxSpeedMs,
          minAGLClearance: s.minAGLClearance,
        }
      : undefined,
    items: [...original.waypoints]
      .sort((a, b) => a.sequence - b.sequence)
      .map((wp) => ({
        sequence: wp.sequence,
        action: wp.action,
        command: wp.command,
        frame: wp.frame,
        name: wp.name,
        latitude: wp.latitude,
        longitude: wp.longitude,
        altitude: wp.altitude,
        speed: wp.speed,
        notes: wp.notes,
        param1: wp.param1,
        param2: wp.param2,
        param3: wp.param3,
        param4: wp.param4,
        param5: wp.param5,
        param6: wp.param6,
        param7: wp.param7,
      })),
    zones: original.zones.map((z) => ({
      kind: z.kind,
      shape: z.shape,
      label: z.label,
      enabled: z.enabled,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      radiusM: z.radiusM,
      vertices: Array.isArray(z.vertices) ? (z.vertices as [number, number][]) : null,
      minAltM: z.minAltM,
      maxAltM: z.maxAltM,
    })),
  });
}

export interface ListOptions {
  query?: string;
  sort: 'updated' | 'name' | 'created';
  status?: 'draft' | 'ready' | 'archived';
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Dashboard list: summary columns only, never waypoints. */
export async function listMissions(userId: string, opts: ListOptions) {
  let q = db.orm.public.Mission.where({ userId });
  if (opts.query) {
    const pattern = `%${escapeLike(opts.query)}%`;
    q = q.where((m) => m.name.ilike(pattern));
  }
  if (opts.status) {
    const status = opts.status;
    q = q.where((m) => m.status.eq(status));
  }
  const ordered =
    opts.sort === 'name'
      ? q.orderBy((m) => m.name.asc())
      : opts.sort === 'created'
        ? q.orderBy((m) => m.createdAt.desc())
        : q.orderBy((m) => m.updatedAt.desc());
  return ordered.limit(500).all();
}

/** Narrowed type helper so routes can hand repo rows to the mapper. */
export function asDbMission(m: FullMission): DbMission {
  return m as unknown as DbMission;
}
