import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface NoFlyZone {
  id: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  label: string;
}

export interface ConstraintConfig {
  maxDistanceM: number;
  maxAltM: number;
  minAltM: number;
  maxSpeedMs: number;
  minAGLClearance: number;
  defaultSpeedMs: number;
}

export interface ConstraintViolation {
  seq?: number;
  field: string;
  message: string;
}

interface ConstraintsStoreState {
  config: ConstraintConfig;
  nfzs: NoFlyZone[];
  selectedNfzId: string | null;
  updateConfig: (updates: Partial<ConstraintConfig>) => void;
  addNfz: (lat: number, lng: number, radiusM: number, label?: string) => void;
  updateNfz: (id: string, updates: Partial<Omit<NoFlyZone, 'id'>>) => void;
  deleteNfz: (id: string) => void;
  selectNfz: (id: string | null) => void;
}

const DEFAULT_CONFIG: ConstraintConfig = {
  maxDistanceM: 10000,
  maxAltM: 400,
  minAltM: 10,
  maxSpeedMs: 20,
  minAGLClearance: 30,
  defaultSpeedMs: 10,
};

export const useConstraintsStore = create<ConstraintsStoreState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      nfzs: [],
      selectedNfzId: null,

      updateConfig: (updates) =>
        set((state) => ({ config: { ...state.config, ...updates } })),

      addNfz: (lat, lng, radiusM, label) =>
        set((state) => ({
          nfzs: [
            ...state.nfzs,
            {
              id: uuidv4(),
              latitude: lat,
              longitude: lng,
              radiusM,
              label: label ?? `NFZ ${state.nfzs.length + 1}`,
            },
          ],
        })),

      updateNfz: (id, updates) =>
        set((state) => ({
          nfzs: state.nfzs.map((nfz) =>
            nfz.id === id ? { ...nfz, ...updates } : nfz
          ),
        })),

      deleteNfz: (id) =>
        set((state) => ({
          nfzs: state.nfzs.filter((nfz) => nfz.id !== id),
          selectedNfzId: state.selectedNfzId === id ? null : state.selectedNfzId,
        })),

      selectNfz: (id) => set({ selectedNfzId: id }),
    }),
    {
      name: 'mps-constraints-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
