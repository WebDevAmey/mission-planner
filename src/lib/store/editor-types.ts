import type { MissionPlan, MissionPlanSettings } from '@/types/mission';

/** Mission settings incl. the server's newer optional columns. */
export type EditorSettings = MissionPlanSettings & {
  cruiseSpeed?: number;
  hoverSpeed?: number;
  turnaroundM?: number;
  homeElevationM?: number | null;
  ratedEnduranceS?: number;
};

/**
 * Editor-side document types. A mission open in the editor carries its zones and
 * limits so that undo/redo, autosave and validation all see one document
 * (PRODUCT_SPEC W5: zones and limits are stored per mission on the server).
 *
 * The zone shape mirrors the API / `Zone` table (TECHNICAL_SPEC §3.2) so it can be
 * sent to PATCH /api/missions/:id without mapping.
 */
export type ZoneKind = 'no_fly' | 'keep_in' | 'keep_out';
export type ZoneShape = 'circle' | 'polygon';

export interface MissionZone {
  id: string;
  kind: ZoneKind;
  shape: ZoneShape;
  label: string;
  enabled: boolean;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  /** Polygon ring as [lng, lat] pairs (not closed). */
  vertices: [number, number][] | null;
  minAltM?: number | null;
  maxAltM?: number | null;
}

export interface MissionLimits {
  maxDistanceM: number;
  maxAltM: number;
  minAltM: number;
  maxSpeedMs: number;
  minAGLClearance: number;
}

export const DEFAULT_LIMITS: MissionLimits = {
  maxDistanceM: 10000,
  maxAltM: 400,
  minAltM: 10,
  maxSpeedMs: 20,
  minAGLClearance: 30,
};

export type EditorMission = MissionPlan & {
  settings: EditorSettings;
  zones: MissionZone[];
  limits: MissionLimits;
};

export const ZONE_KIND_LABEL: Record<ZoneKind, string> = {
  no_fly: 'No-fly',
  keep_out: 'Keep-out',
  keep_in: 'Keep-in',
};

/** Accepts whatever the API returns (zones/limits may be missing before the
 * server supports them) and produces a complete editor document. */
export function toEditorMission(raw: MissionPlan & { zones?: unknown; limits?: unknown }): EditorMission {
  const zones = Array.isArray(raw.zones) ? (raw.zones as MissionZone[]).map(normaliseZone) : [];
  const limits =
    raw.limits && typeof raw.limits === 'object'
      ? { ...DEFAULT_LIMITS, ...(raw.limits as Partial<MissionLimits>) }
      : { ...DEFAULT_LIMITS };
  return { ...raw, zones, limits };
}

function normaliseZone(z: MissionZone): MissionZone {
  return {
    id: z.id,
    kind: z.kind ?? 'keep_out',
    shape: z.shape ?? (z.vertices ? 'polygon' : 'circle'),
    label: z.label ?? 'Zone',
    enabled: z.enabled ?? true,
    centerLat: z.centerLat ?? null,
    centerLng: z.centerLng ?? null,
    radiusM: z.radiusM ?? null,
    vertices: z.vertices ?? null,
    minAltM: z.minAltM ?? null,
    maxAltM: z.maxAltM ?? null,
  };
}
