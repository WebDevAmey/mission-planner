import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { MissionPlan } from '@/types/mission';

function getNextMissionName(existing: string[]): string {
  let n = 1;
  while (existing.includes(`Mission ${String(n).padStart(3, '0')}`)) n++;
  return `Mission ${String(n).padStart(3, '0')}`;
}

const DEFAULT_SETTINGS = {
  defaultAltitude: 80,
  defaultSpeed: 12,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative' as const,
};

function createBlankMission(name: string): MissionPlan {
  return {
    id: uuidv4(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [],
    settings: DEFAULT_SETTINGS,
    homePosition: null,
  };
}

interface MissionLibraryStoreState {
  missions: Record<string, MissionPlan>;
  activeMissionId: string | null;
  createMission: (name?: string) => MissionPlan;
  loadMission: (id: string) => MissionPlan | null;
  deleteMission: (id: string) => MissionPlan | null;
  duplicateMission: (id: string) => MissionPlan | null;
  renameMission: (id: string, name: string) => void;
  syncMission: (mission: MissionPlan) => void;
  getMissionList: () => MissionPlan[];
  getMissionsByIds: (ids: string[]) => MissionPlan[];
}

export const useMissionLibraryStore = create<MissionLibraryStoreState>()(
  persist(
    (set, get) => ({
      missions: {},
      activeMissionId: null,

      createMission: (name) => {
        const existing = Object.values(get().missions).map((m) => m.name);
        const resolvedName = name ?? getNextMissionName(existing);
        const mission = createBlankMission(resolvedName);
        set((s) => ({
          missions: { ...s.missions, [mission.id]: mission },
          activeMissionId: mission.id,
        }));
        return mission;
      },

      loadMission: (id) => {
        const mission = get().missions[id] ?? null;
        if (mission) set({ activeMissionId: id });
        return mission;
      },

      deleteMission: (id) => {
        const state = get();
        const missions = { ...state.missions };
        delete missions[id];
        const remaining = Object.keys(missions);

        let nextActive: MissionPlan | null = null;
        let nextId: string | null = null;

        if (state.activeMissionId === id) {
          if (remaining.length > 0) {
            const sorted = Object.values(missions).sort(
              (a, b) => b.updatedAt.localeCompare(a.updatedAt)
            );
            nextActive = sorted[0];
            nextId = sorted[0].id;
          } else {
            const blank = createBlankMission(getNextMissionName([]));
            missions[blank.id] = blank;
            nextActive = blank;
            nextId = blank.id;
          }
        } else {
          nextId = state.activeMissionId;
        }

        set({ missions, activeMissionId: nextId });
        return nextActive;
      },

      duplicateMission: (id) => {
        const original = get().missions[id];
        if (!original) return null;
        const copy: MissionPlan = {
          ...JSON.parse(JSON.stringify(original)),
          id: uuidv4(),
          name: `${original.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({
          missions: { ...s.missions, [copy.id]: copy },
          activeMissionId: copy.id,
        }));
        return copy;
      },

      renameMission: (id, name) => {
        if (!name.trim()) return;
        set((s) => {
          const mission = s.missions[id];
          if (!mission) return s;
          return {
            missions: {
              ...s.missions,
              [id]: { ...mission, name: name.trim(), updatedAt: new Date().toISOString() },
            },
          };
        });
      },

      syncMission: (mission) => {
        set((s) => ({
          missions: { ...s.missions, [mission.id]: mission },
        }));
      },

      getMissionList: () =>
        Object.values(get().missions).sort(
          (a, b) => b.updatedAt.localeCompare(a.updatedAt)
        ),

      getMissionsByIds: (ids) => {
        const { missions } = get();
        return ids
          .map((id) => missions[id])
          .filter(Boolean)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },
    }),
    {
      name: 'mps-mission-library',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
