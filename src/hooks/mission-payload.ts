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
