import { describe, expect, it } from 'vitest';
import { updateMissionSchema } from '@/lib/validation/mission';
import { PlannerAction } from '@/lib/mavlink/commands';
import { toEditorMission, type EditorMission } from '@/lib/store/editor-types';
import { buildAutosaveBody, buildMissionPatch, missionPatchParts } from '@/hooks/mission-payload';
import { item, plan } from './fixtures';

function editorMission(): EditorMission {
  return toEditorMission({
    ...plan([item(PlannerAction.TAKEOFF, 47, 8, 30), item(PlannerAction.WAYPOINT, 47.001, 8, 50), item(PlannerAction.RTL)]),
    zones: [{ id: 'z1', kind: 'no_fly', shape: 'circle', label: 'Tower', enabled: true, centerLat: 47.01, centerLng: 8.01, radiusM: 50, vertices: null, minAltM: null, maxAltM: null }],
  });
}

describe('autosave payload parts', () => {
  it('serialises each snapshot once and leaves item ids out', () => {
    const m = editorMission();
    const a = missionPatchParts(m);
    expect(missionPatchParts(m)).toBe(a);
    expect(a.items.every((i) => !('id' in i))).toBe(true);
    // Same content as the full patch apart from the ids.
    const full = buildMissionPatch(m, null);
    expect(a.items).toEqual(
      full.items!.map((it) => {
        const copy = { ...it };
        delete copy.id;
        return copy;
      })
    );
    expect(a.fingerprint).toBe(missionPatchParts({ ...m }).fingerprint);
  });

  it('sends only changed parts when the base version is known', () => {
    const m = editorMission();
    const saved = missionPatchParts(m).json;
    const renamed = { ...m, name: 'Renamed' };
    const body = buildAutosaveBody(missionPatchParts(renamed), 4, saved);
    expect(body).toMatchObject({ name: 'Renamed', baseVersion: 4 });
    expect(body).not.toHaveProperty('items');
    expect(body).not.toHaveProperty('zones');
    expect(updateMissionSchema.safeParse(body).success).toBe(true);

    const moved = { ...m, items: m.items.map((it, i) => (i === 1 ? { ...it, latitude: 47.002 } : it)) };
    const body2 = buildAutosaveBody(missionPatchParts(moved), 4, saved);
    expect(body2.items).toHaveLength(3);
    expect(body2).not.toHaveProperty('zones');
    expect(updateMissionSchema.safeParse(body2).success).toBe(true);
  });

  it('sends everything without a base version or a confirmed save', () => {
    const m = editorMission();
    const parts = missionPatchParts(m);
    for (const body of [buildAutosaveBody(parts, null, parts.json), buildAutosaveBody(parts, 2, null)]) {
      expect(body.items).toHaveLength(3);
      expect(body.zones).toHaveLength(1);
      expect(updateMissionSchema.safeParse(body).success).toBe(true);
    }
  });
});
