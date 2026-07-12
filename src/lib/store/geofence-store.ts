import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export interface GeofenceItem {
  id: string;
  type: 'circle' | 'polygon';
  mode: 'keep-in' | 'keep-out';
  label: string;
  color: string;
  center?: { lat: number; lng: number };
  radiusM?: number;
  vertices?: { lat: number; lng: number }[];
  enabled: boolean;
}

function modeColor(mode: 'keep-in' | 'keep-out'): string {
  return mode === 'keep-in' ? '#2d7dd2' : '#ff3333';
}

interface GeofenceStoreState {
  geofences: GeofenceItem[];
  selectedGeofenceId: string | null;
  addCircleGeofence: (
    center: { lat: number; lng: number },
    radiusM: number,
    mode: 'keep-in' | 'keep-out',
    label?: string
  ) => string;
  addPolygonGeofence: (
    vertices: { lat: number; lng: number }[],
    mode: 'keep-in' | 'keep-out',
    label?: string
  ) => string;
  updateGeofence: (id: string, partial: Partial<Omit<GeofenceItem, 'id'>>) => void;
  deleteGeofence: (id: string) => void;
  toggleGeofence: (id: string) => void;
  selectGeofence: (id: string | null) => void;
}

export const useGeofenceStore = create<GeofenceStoreState>()(
  persist(
    (set, get) => ({
      geofences: [],
      selectedGeofenceId: null,

      addCircleGeofence: (center, radiusM, mode, label) => {
        const id = uuidv4();
        const item: GeofenceItem = {
          id,
          type: 'circle',
          mode,
          label: label ?? `${mode === 'keep-in' ? 'Keep-In' : 'Keep-Out'} Zone ${get().geofences.length + 1}`,
          color: modeColor(mode),
          center,
          radiusM,
          enabled: true,
        };
        set((s) => ({ geofences: [...s.geofences, item] }));
        return id;
      },

      addPolygonGeofence: (vertices, mode, label) => {
        const id = uuidv4();
        const item: GeofenceItem = {
          id,
          type: 'polygon',
          mode,
          label: label ?? `${mode === 'keep-in' ? 'Keep-In' : 'Keep-Out'} Zone ${get().geofences.length + 1}`,
          color: modeColor(mode),
          vertices,
          enabled: true,
        };
        set((s) => ({ geofences: [...s.geofences, item] }));
        return id;
      },

      updateGeofence: (id, partial) => {
        set((s) => ({
          geofences: s.geofences.map((g) =>
            g.id === id ? { ...g, ...partial } : g
          ),
        }));
      },

      deleteGeofence: (id) => {
        set((s) => ({
          geofences: s.geofences.filter((g) => g.id !== id),
          selectedGeofenceId: s.selectedGeofenceId === id ? null : s.selectedGeofenceId,
        }));
      },

      toggleGeofence: (id) => {
        set((s) => ({
          geofences: s.geofences.map((g) =>
            g.id === id ? { ...g, enabled: !g.enabled } : g
          ),
        }));
      },

      selectGeofence: (id) => set({ selectedGeofenceId: id }),
    }),
    {
      name: 'mps-geofence-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
