import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
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
} from '@/types/mission';

interface MissionStoreState {
  mission: MissionPlan | null;
  past: MissionPlan[];
  future: MissionPlan[];
  createMission: (name?: string) => void;
  loadMission: (mission: MissionPlan) => void;
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

const cloneMission = (mission: MissionPlan): MissionPlan =>
  JSON.parse(JSON.stringify(mission)) as MissionPlan;

const createEmptyMission = (name: string): MissionPlan => ({
  id: uuidv4(),
  name,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [],
  settings: DEFAULT_SETTINGS,
  homePosition: null,
});

const withHistory = (
  currentMission: MissionPlan,
  get: () => MissionStoreState,
  set: (value: Partial<MissionStoreState>) => void,
  updater: (draft: MissionPlan) => MissionPlan
): void => {
  const baseMission = cloneMission(currentMission);
  const nextMission = updater(baseMission);

  set({
    mission: {
      ...nextMission,
      items: resequenceMissionItems(nextMission.items, nextMission.settings),
      updatedAt: new Date().toISOString(),
    },
    past: [...get().past, currentMission],
    future: [],
  });
};

const getSeedCoordinate = (mission: MissionPlan): Partial<MissionCoordinates> | undefined => {
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

export const useMissionStore = create<MissionStoreState>()(
  persist(
    (set, get) => ({
      mission: null,
      past: [],
      future: [],

      createMission: (name = 'Mission 001') => {
        set({
          mission: createEmptyMission(name),
          past: [],
          future: [],
        });
      },

      loadMission: (mission) => {
        set({
          mission: {
            ...mission,
            items: resequenceMissionItems(mission.items, mission.settings),
          },
          past: [],
          future: [],
        });
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
        });
      },

      redo: () => {
        const { mission, past, future } = get();
        if (!mission || future.length === 0) return;

        const [next, ...remaining] = future;
        set({
          mission: next,
          past: [...past, mission],
          future: remaining,
        });
      },

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,
    }),
    {
      name: 'mps-offline-mission-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        mission: state.mission,
      }),
    }
  )
);
