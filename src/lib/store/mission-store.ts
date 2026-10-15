import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { PlannerAction } from '@/lib/mavlink/commands';
import {
  createMissionItem,
  exportMission,
  normalizeMissionItem,
  resequenceMissionItems,
  type MissionExportFormat,
} from '@/lib/services/mission-builder';
import type {
  HomePosition,
  MissionCoordinates,
  MissionExportPayload,
  MissionItem,
  MissionPlan,
  MissionPlanSettings,
} from '@/types/mission';
import {
  DEFAULT_LIMITS,
  toEditorMission,
  type EditorMission,
  type MissionLimits,
  type MissionZone,
} from '@/lib/store/editor-types';

const HISTORY_LIMIT = 100;

interface MissionStoreState {
  mission: EditorMission | null;
  past: EditorMission[];
  future: EditorMission[];
  /** Label of the most recent undoable change (for "Undo <label>" affordances). */
  lastChangeLabel: string | null;
  createMission: (name?: string) => void;
  /** Replace the open document and reset history (fresh load from the server). */
  loadMission: (mission: MissionPlan | EditorMission) => void;
  /** Apply any document change as exactly one undo step. */
  applyChange: (label: string, updater: (draft: EditorMission) => EditorMission) => void;
  /** Replace all items as one undo step (templates, Flight Deck, planners). */
  replaceItems: (items: MissionItem[], label?: string) => void;
  updateSettings: (settings: Partial<MissionPlanSettings>) => void;
  updateLimits: (limits: Partial<MissionLimits>) => void;
  addZone: (zone: Omit<MissionZone, 'id'> & { id?: string }) => string | null;
  updateZone: (id: string, updates: Partial<Omit<MissionZone, 'id'>>) => void;
  deleteZone: (id: string) => void;
  updateMissionName: (name: string) => void;
  addMissionItem: (
    action: PlannerAction,
    options?: { index?: number; coordinate?: Partial<MissionCoordinates> }
  ) => string | null;
  updateMissionItem: (itemId: string, updates: Partial<MissionItem>) => void;
  setMissionItemAction: (itemId: string, action: PlannerAction) => void;
  deleteMissionItem: (itemId: string) => void;
  bulkDeleteMissionItems: (itemIds: string[]) => void;
  duplicateMissionItem: (itemId: string) => void;
  reorderMissionItems: (fromIndex: number, toIndex: number) => void;
  insertMissionItemAt: (
    action: PlannerAction,
    index: number,
    coordinate?: Partial<MissionCoordinates>
  ) => void;
  clearMission: () => void;
  exportMission: (format: MissionExportFormat) => MissionExportPayload | null;
  setHomePosition: (home: HomePosition | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const DEFAULT_SETTINGS = {
  defaultAltitude: 80,
  defaultSpeed: 12,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative' as const,
};

const cloneMission = (mission: EditorMission): EditorMission =>
  JSON.parse(JSON.stringify(mission)) as EditorMission;

const createEmptyMission = (name: string): EditorMission => ({
  id: uuidv4(),
  name,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [],
  settings: DEFAULT_SETTINGS,
  homePosition: null,
  zones: [],
  limits: { ...DEFAULT_LIMITS },
});

const withHistory = (
  currentMission: EditorMission,
  get: () => MissionStoreState,
  set: (value: Partial<MissionStoreState>) => void,
  updater: (draft: EditorMission) => EditorMission,
  label = 'Edit'
): void => {
  const baseMission = cloneMission(currentMission);
  const nextMission = updater(baseMission);

  set({
    mission: {
      ...nextMission,
      items: resequenceMissionItems(nextMission.items, nextMission.settings),
      updatedAt: new Date().toISOString(),
    },
    past: [...get().past, currentMission].slice(-HISTORY_LIMIT),
    future: [],
    lastChangeLabel: label,
  });
};

const getSeedCoordinate = (mission: EditorMission): Partial<MissionCoordinates> | undefined => {
  const lastSpatialItem = [...mission.items]
    .reverse()
    .find((item) => item.latitude !== null && item.longitude !== null);

  if (!lastSpatialItem) {
    return undefined;
  }

  return {
    latitude: lastSpatialItem.latitude,
    longitude: lastSpatialItem.longitude,
    altitude: lastSpatialItem.altitude ?? mission.settings.defaultAltitude,
  };
};

// Missions are now persisted server-side (see /api/missions); this store is
// an in-memory editing buffer hydrated from the API, not a source of truth,
// so it deliberately isn't backed by localStorage anymore.
export const useMissionStore = create<MissionStoreState>()(
  (set, get) => ({
      mission: null,
      past: [],
      future: [],
      lastChangeLabel: null,

      createMission: (name = 'Mission 001') => {
        set({
          mission: createEmptyMission(name),
          past: [],
          future: [],
        });
      },

      loadMission: (mission) => {
        const doc = toEditorMission(mission);
        set({
          mission: {
            ...doc,
            items: resequenceMissionItems(doc.items, doc.settings),
          },
          past: [],
          future: [],
          lastChangeLabel: null,
        });
      },

      applyChange: (label, updater) => {
        const mission = get().mission;
        if (!mission) return;
        withHistory(mission, get, set, updater, label);
      },

      replaceItems: (items, label = 'Replace items') => {
        const mission = get().mission;
        if (!mission) return;
        withHistory(
          mission,
          get,
          set,
          (draft) => ({
            ...draft,
            items: items.map((item) => normalizeMissionItem({ ...item }, draft.settings)),
          }),
          label
        );
      },

      updateSettings: (settings) => {
        const mission = get().mission;
        if (!mission) return;
        withHistory(mission, get, set, (draft) => ({ ...draft, settings: { ...draft.settings, ...settings } }), 'Change defaults');
      },

      updateLimits: (limits) => {
        const mission = get().mission;
        if (!mission) return;
        withHistory(mission, get, set, (draft) => ({ ...draft, limits: { ...draft.limits, ...limits } }), 'Change limits');
      },

      addZone: (zone) => {
        const mission = get().mission;
        if (!mission) return null;
        const id = zone.id ?? uuidv4();
        withHistory(mission, get, set, (draft) => ({ ...draft, zones: [...draft.zones, { ...zone, id }] }), 'Add zone');
        return id;
      },

      updateZone: (id, updates) => {
        const mission = get().mission;
        if (!mission) return;
        withHistory(
          mission,
          get,
          set,
          (draft) => ({ ...draft, zones: draft.zones.map((z) => (z.id === id ? { ...z, ...updates } : z)) }),
          'Edit zone'
        );
      },

      deleteZone: (id) => {
        const mission = get().mission;
        if (!mission) return;
        withHistory(mission, get, set, (draft) => ({ ...draft, zones: draft.zones.filter((z) => z.id !== id) }), 'Delete zone');
      },

      updateMissionName: (name) => {
        const mission = get().mission;
        if (!mission || !name.trim()) {
          return;
        }
        withHistory(mission, get, set, (draft) => ({
          ...draft,
          name: name.trim(),
        }));
      },

      addMissionItem: (action, options) => {
        const mission = get().mission;
        if (!mission) {
          return null;
        }

        let newId: string | null = null;

        withHistory(mission, get, set, (draft) => {
          const index = options?.index ?? draft.items.length;
          const nextItem = createMissionItem(
            action,
            index,
            draft.settings,
            options?.coordinate ?? getSeedCoordinate(draft)
          );

          newId = nextItem.id;
          const items = [...draft.items];
          items.splice(index, 0, nextItem);

          return { ...draft, items };
        });

        return newId;
      },

      updateMissionItem: (itemId, updates) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => ({
          ...draft,
          items: draft.items.map((item) => {
            if (item.id !== itemId) return item;
            return normalizeMissionItem(
              {
                ...item,
                ...updates,
                parameters: {
                  ...item.parameters,
                  ...(updates.parameters ?? {}),
                },
              },
              draft.settings
            );
          }),
        }));
      },

      setMissionItemAction: (itemId, action) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => ({
          ...draft,
          items: draft.items.map((item) => {
            if (item.id !== itemId) return item;

            const replacement = createMissionItem(action, item.sequence, draft.settings, {
              latitude: item.latitude ?? undefined,
              longitude: item.longitude ?? undefined,
              altitude: item.altitude ?? undefined,
            });

            return { ...replacement, id: item.id, notes: item.notes };
          }),
        }));
      },

      deleteMissionItem: (itemId) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => ({
          ...draft,
          items: draft.items.filter((item) => item.id !== itemId),
        }));
      },

      bulkDeleteMissionItems: (itemIds) => {
        const mission = get().mission;
        if (!mission) return;

        const idSet = new Set(itemIds);
        withHistory(mission, get, set, (draft) => ({
          ...draft,
          items: draft.items.filter((item) => !idSet.has(item.id)),
        }));
      },

      duplicateMissionItem: (itemId) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => {
          const idx = draft.items.findIndex((i) => i.id === itemId);
          if (idx === -1) return draft;

          const original = draft.items[idx];
          const copy: MissionItem = {
            ...JSON.parse(JSON.stringify(original)),
            id: uuidv4(),
          };

          const items = [...draft.items];
          items.splice(idx + 1, 0, copy);
          return { ...draft, items };
        });
      },

      reorderMissionItems: (fromIndex, toIndex) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => {
          const items = [...draft.items];
          const [moved] = items.splice(fromIndex, 1);
          items.splice(toIndex, 0, moved);
          return { ...draft, items };
        });
      },

      insertMissionItemAt: (action, index, coordinate) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => {
          const newItem = createMissionItem(action, index, draft.settings, coordinate);
          const items = [...draft.items];
          items.splice(index, 0, newItem);
          return { ...draft, items };
        });
      },

      clearMission: () => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => ({ ...draft, items: [] }));
      },

      exportMission: (format) => {
        const mission = get().mission;
        if (!mission) return null;
        return exportMission(mission, format);
      },

      setHomePosition: (home) => {
        const mission = get().mission;
        if (!mission) return;

        withHistory(mission, get, set, (draft) => ({
          ...draft,
          homePosition: home,
        }));
      },

      undo: () => {
        const { mission, past, future } = get();
        if (!mission || past.length === 0) return;

        const previous = past[past.length - 1];
        set({
          mission: previous,
          past: past.slice(0, -1),
          future: [mission, ...future],
          lastChangeLabel: null,
        });
      },

      redo: () => {
        const { mission, past, future } = get();
        if (!mission || future.length === 0) return;

        const [next, ...remaining] = future;
        set({
          mission: next,
          past: [...past, mission].slice(-HISTORY_LIMIT),
          future: remaining,
          lastChangeLabel: null,
        });
      },

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,
    })
);
