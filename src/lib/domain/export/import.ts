import {
  MAVLINK_COMMAND_DEFINITIONS,
  MavlinkFrame,
  PlannerAction,
  getMissionCommandDefinition,
} from '@/lib/mavlink/commands';
import { createMissionItem, normalizeMissionItem } from '@/lib/domain/items';
import type { LngLat } from '@/lib/domain/geo';
import type { Zone } from '@/lib/domain/zones';
import type { HomePosition, MissionItem, MissionPlanSettings } from '@/types/mission';
import type { RallyPoint } from './qgc-plan';

export interface ImportedMission {
  name?: string;
  description?: string;
  items: MissionItem[];
  homePosition: HomePosition | null;
  settings?: Partial<MissionPlanSettings>;
  zones: Zone[];
  rallyPoints: RallyPoint[];
  /** Human-readable notes about skipped or adjusted content. */
  warnings: string[];
}

export class MissionImportError extends Error {}

/** A wire row: MAVLink mission item as stored in .plan / .waypoints files. */
export interface WireRow {
  command: number;
  frame: number;
  params: number[];
  autocontinue?: boolean;
  speed?: number | null;
  notes?: string | null;
  id?: string;
  action?: string;
}

const ACTION_BY_COMMAND = new Map<number, PlannerAction>(
  Object.values(MAVLINK_COMMAND_DEFINITIONS).map((d) => [d.command as number, d.action])
);
const KNOWN_FRAMES = new Set<number>([
  MavlinkFrame.MAV_FRAME_GLOBAL,
  MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
  MavlinkFrame.MAV_FRAME_GLOBAL_TERRAIN_ALT,
]);

const DEFAULT_SETTINGS: MissionPlanSettings = {
  defaultAltitude: 50,
  defaultSpeed: 10,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative',
};

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/**
 * Converts wire rows (without the home row) to editor items. A DO_CHANGE_SPEED directly
 * before a speed-capable nav item is folded into that item's `speed` (the inverse of
 * export). DO_JUMP param1 is converted from wire sequence (home = 0) to 1-based item index.
 */
export function rowsToItems(rows: WireRow[], settings: MissionPlanSettings = DEFAULT_SETTINGS, warnings: string[] = []): MissionItem[] {
  const items: MissionItem[] = [];
  const rowToItem: number[] = [];
  let pendingSpeed: number | null = null;
  rows.forEach((row, ri) => {
    const action = (row.action as PlannerAction) ?? ACTION_BY_COMMAND.get(row.command);
    const known = action && ACTION_BY_COMMAND.get(row.command) === action;
    if (!known) {
      warnings.push(`Row ${ri + 1}: unsupported command ${row.command} was skipped`);
      rowToItem.push(items.length);
      return;
    }
    const p = Array.from({ length: 7 }, (_, k) => n(row.params[k]));
    const next = rows[ri + 1];
    const nextAction = next ? ACTION_BY_COMMAND.get(next.command) : undefined;
    if (
      action === PlannerAction.SET_SPEED &&
      row.speed === undefined &&
      p[1] > 0 &&
      nextAction &&
      getMissionCommandDefinition(nextAction).supportsSpeed
    ) {
      pendingSpeed = p[1];
      rowToItem.push(items.length);
      return;
    }
    const def = getMissionCommandDefinition(action);
    const base = createMissionItem(action, items.length, settings);
    const item: MissionItem = {
      ...base,
      id: row.id ?? base.id,
      frame: (KNOWN_FRAMES.has(row.frame) ? row.frame : MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT) as MavlinkFrame,
      latitude: def.supportsCoordinates ? p[4] : null,
      longitude: def.supportsCoordinates ? p[5] : null,
      altitude: def.supportsAltitude ? p[6] : null,
      parameters: { param1: p[0], param2: p[1], param3: p[2], param4: p[3], param5: p[4], param6: p[5], param7: p[6] },
    };
    if (row.speed != null && row.speed > 0) item.speed = row.speed;
    else if (pendingSpeed != null) item.speed = pendingSpeed;
    if (row.notes) item.notes = row.notes;
    if (!KNOWN_FRAMES.has(row.frame)) warnings.push(`Row ${ri + 1}: frame ${row.frame} replaced by relative altitude`);
    pendingSpeed = null;
    rowToItem.push(items.length);
    items.push(normalizeMissionItem(item, settings));
  });
  return items.map((it, i) => {
    const out = { ...it, sequence: i };
    if (it.action === PlannerAction.DO_JUMP) {
      const target = rowToItem[Math.round(it.parameters.param1) - 1];
      if (target !== undefined) out.parameters = { ...it.parameters, param1: target + 1 };
    }
    return out;
  });
}

let zoneSeq = 0;
const zoneId = () => `imported-zone-${++zoneSeq}`;

/** Parse a QGroundControl `.plan` file. */
export function parsePlan(text: string, settings?: MissionPlanSettings): ImportedMission {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new MissionImportError('Not valid JSON');
  }
  if (doc?.fileType !== 'Plan') throw new MissionImportError('Not a QGroundControl .plan file');
  const mission = (doc.mission ?? {}) as Record<string, unknown>;
  const warnings: string[] = [];
  const rows: WireRow[] = [];
  for (const raw of (mission.items as Record<string, unknown>[]) ?? []) {
    if (raw.type !== 'SimpleItem') {
      warnings.push(`Complex item "${String(raw.complexItemType ?? raw.type)}" was skipped`);
      continue;
    }
    rows.push({
      command: n(raw.command),
      frame: n(raw.frame),
      params: ((raw.params as unknown[]) ?? []).map(n),
      autocontinue: raw.autoContinue !== false,
    });
  }
  const home = mission.plannedHomePosition as number[] | undefined;
  const fence = (doc.geoFence ?? {}) as { polygons?: { inclusion?: boolean; polygon: number[][] }[]; circles?: { inclusion?: boolean; circle: { center: number[]; radius: number } }[] };
  const zones: Zone[] = [
    ...(fence.polygons ?? []).map(
      (p, i): Zone => ({
        id: zoneId(),
        kind: p.inclusion ? 'keep_in' : 'keep_out',
        shape: 'polygon',
        label: `Fence ${i + 1}`,
        enabled: true,
        vertices: p.polygon.map(([lat, lng]) => [lng, lat] as LngLat),
      })
    ),
    ...(fence.circles ?? []).map(
      (c, i): Zone => ({
        id: zoneId(),
        kind: c.inclusion ? 'keep_in' : 'keep_out',
        shape: 'circle',
        label: `Circle ${i + 1}`,
        enabled: true,
        centerLat: c.circle.center[0],
        centerLng: c.circle.center[1],
        radiusM: c.circle.radius,
      })
    ),
  ];
  const rally = ((doc.rallyPoints as { points?: number[][] })?.points ?? []).map(([latitude, longitude, altitude]) => ({ latitude, longitude, altitude: altitude ?? 0 }));
  return {
    items: rowsToItems(rows, settings, warnings),
    homePosition: home && home.length >= 2 && !(home[0] === 0 && home[1] === 0) ? { latitude: home[0], longitude: home[1], altitude: home[2] ?? 0 } : null,
    settings: typeof mission.cruiseSpeed === 'number' ? { defaultSpeed: mission.cruiseSpeed } : undefined,
    zones,
    rallyPoints: rally,
    warnings,
  };
}

/** Parse a `QGC WPL 110` `.waypoints` file (row 0 is home). */
export function parseWaypoints(text: string, settings?: MissionPlanSettings): ImportedMission {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!/^QGC WPL 1[01]0$/.test(lines[0] ?? '')) throw new MissionImportError('Missing "QGC WPL 110" header');
  const warnings: string[] = [];
  let homePosition: HomePosition | null = null;
  const rows: WireRow[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = line.split(/\t|\s+/).map(Number);
    if (c.length < 12 || c.some((x) => Number.isNaN(x))) {
      warnings.push(`Line ${i + 2} is malformed and was skipped`);
      return;
    }
    if (c[0] === 0 && i === 0) {
      if (!(c[8] === 0 && c[9] === 0)) homePosition = { latitude: c[8], longitude: c[9], altitude: c[10] };
      return;
    }
    rows.push({ frame: c[2], command: c[3], params: c.slice(4, 11), autocontinue: c[11] === 1 });
  });
  return { items: rowsToItems(rows, settings, warnings), homePosition, zones: [], rallyPoints: [], warnings };
}

/** Parse the app's own MissionPlannerMission JSON (v1.0 / v1.1). */
export function parseMpsJson(text: string, settings?: MissionPlanSettings): ImportedMission {
  let doc: Record<string, unknown>;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new MissionImportError('Not valid JSON');
  }
  if (doc?.fileType !== 'MissionPlannerMission') throw new MissionImportError('Not a Flight Deck mission file');
  const warnings: string[] = [];
  const s = (doc.settings as MissionPlanSettings | undefined) ?? settings;
  const rows: WireRow[] = ((doc.items as Record<string, unknown>[]) ?? []).map((it) => ({
    command: n((it.command as { id?: number })?.id ?? it.command),
    frame: typeof it.frameId === 'number' ? it.frameId : MavlinkFrame.MAV_FRAME_GLOBAL_RELATIVE_ALT,
    params: [it.param1, it.param2, it.param3, it.param4, it.param5 ?? it.x, it.param6 ?? it.y, it.param7 ?? it.z].map(n),
    speed: (it.speed_ms as number | null) ?? null,
    notes: (it.notes as string | null) ?? null,
    id: typeof it.id === 'string' ? it.id : undefined,
    action: typeof it.action === 'string' ? it.action : undefined,
  }));
  // MPS JSON stores DO_JUMP targets as 1-based item indexes already, with no speed rows,
  // so rows map 1:1 to items and the remap in rowsToItems is the identity.
  const home = doc.home as { lat: number; lng: number; alt: number } | undefined;
  return {
    name: typeof doc.missionName === 'string' ? doc.missionName : undefined,
    description: typeof doc.description === 'string' ? doc.description : undefined,
    items: rowsToItems(rows, s ?? undefined, warnings),
    homePosition: home && !(home.lat === 0 && home.lng === 0) ? { latitude: home.lat, longitude: home.lng, altitude: home.alt ?? 0 } : null,
    settings: s,
    zones: Array.isArray(doc.zones) ? (doc.zones as Zone[]) : [],
    rallyPoints: [],
    warnings,
  };
}

/** Pick a parser from the file name / content. */
export function parseMissionFile(filename: string, text: string, settings?: MissionPlanSettings): ImportedMission {
  const lower = filename.toLowerCase();
  const head = text.trimStart();
  if (lower.endsWith('.waypoints') || lower.endsWith('.txt') || head.startsWith('QGC WPL')) return parseWaypoints(text, settings);
  if (head.startsWith('{')) {
    if (/"fileType"\s*:\s*"Plan"/.test(head)) return parsePlan(text, settings);
    return parseMpsJson(text, settings);
  }
  throw new MissionImportError('Unsupported file type. Use .plan, .waypoints or Flight Deck .json');
}

