import { toMissionPatchBody, toWaypointInput } from '@/lib/missions/payload';
import type { EditorMission } from '@/lib/store/editor-types';

export { toWaypointInput as toFlatWaypoint };

/** Whole editor document -> PATCH /api/missions/:id body: core's canonical item
 * mapping plus zones, limits and the optimistic-concurrency base version. */
export function buildMissionPatch(mission: EditorMission, baseVersion: number | null) {
  return {
    ...toMissionPatchBody(mission),
    ...(baseVersion !== null && { baseVersion }),
    limits: mission.limits,
    zones: mission.zones,
  };
}

type MissionPatch = ReturnType<typeof buildMissionPatch>;

/** A save body split into its parts, each with a JSON fingerprint of what the server would store. */
export interface PatchParts {
  core: Omit<MissionPatch, 'items' | 'zones' | 'baseVersion'>;
  items: NonNullable<MissionPatch['items']>;
  zones: MissionPatch['zones'];
  json: { core: string; items: string; zones: string };
  /** Whole-document fingerprint (no version, no timestamps). */
  fingerprint: string;
}

// Missions are immutable snapshots in the store, so one serialisation per snapshot is enough
// (the autosave effect, the save itself and the post-save check all ask for the same one).
const partsCache = new WeakMap<EditorMission, PatchParts>();

/**
 * Splits the save body of `mission` into core fields, items and zones. Item ids are
 * left out: the server assigns its own (TECHNICAL_SPEC S4), and on 2,000 items they
 * are ~90 KB of every autosave.
 */
export function missionPatchParts(mission: EditorMission): PatchParts {
  const cached = partsCache.get(mission);
  if (cached) return cached;
  // No base version passed, so `core` carries none.
  const { items = [], zones, ...core } = buildMissionPatch(mission, null);
  const slimItems = items.map((item) => {
    const copy = { ...item };
    delete copy.id;
    return copy;
  });
  const json = { core: JSON.stringify(core), items: JSON.stringify(slimItems), zones: JSON.stringify(zones) };
  const parts: PatchParts = {
    core,
    items: slimItems,
    zones,
    json,
    fingerprint: `${json.core}\n${json.items}\n${json.zones}`,
  };
  partsCache.set(mission, parts);
  return parts;
}

/**
 * Autosave body for `mission`. With a known `baseVersion` the server holds exactly what
 * was last saved, so items and zones are only sent when they differ from `saved` (the
 * PATCH treats missing parts as unchanged). Without a base version, or when `saved` is
 * null, everything is sent.
 */
export function buildAutosaveBody(parts: PatchParts, baseVersion: number | null, saved: PatchParts['json'] | null) {
  const sendAll = baseVersion === null || saved === null;
  return {
    ...parts.core,
    ...(baseVersion !== null && { baseVersion }),
    ...((sendAll || parts.json.items !== saved.items) && { items: parts.items }),
    ...((sendAll || parts.json.zones !== saved.zones) && { zones: parts.zones }),
  };
}
