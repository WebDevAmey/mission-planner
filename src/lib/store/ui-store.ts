'use client';

import { create } from 'zustand';

export type MapTool =
  | 'select'
  | 'add-wp'
  | 'remove-wp'
  | 'set-home'
  | 'draw-polygon'
  | 'draw-circle'
  | 'measure';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface AlternativeRoute {
  id: string;
  label: string;
  color: string;
  itemIds: string[];
  distanceM: number;
  timeS: number;
  riskScore: number;
}

interface UIStoreState {
  selectedMissionItemId: string | null;
  activeTool: MapTool;
  drawingFence: boolean;
  toasts: Toast[];
  alternativeRoutes: AlternativeRoute[];
  activeAlternativeId: string | null;
  constraintsPanelOpen: boolean;
  missionLibraryOpen: boolean;
  templatePickerOpen: boolean;
  timelineOpen: boolean;
  geofencePanelOpen: boolean;
  terrainPanelOpen: boolean;
  selectMissionItem: (itemId: string | null) => void;
  setActiveTool: (tool: MapTool) => void;
  toggleDrawingFence: () => void;
  setDrawingFence: (drawing: boolean) => void;
  resetSelection: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
  setAlternativeRoutes: (routes: AlternativeRoute[]) => void;
  clearAlternativeRoutes: () => void;
  setActiveAlternative: (id: string | null) => void;
  toggleConstraintsPanel: () => void;
  toggleMissionLibrary: () => void;
  toggleTemplatePicker: () => void;
  toggleTimeline: () => void;
  toggleGeofencePanel: () => void;
  toggleTerrainPanel: () => void;
  setMissionLibraryOpen: (open: boolean) => void;
  setTemplatePickerOpen: (open: boolean) => void;
}

let toastCounter = 0;

export const useUIStore = create<UIStoreState>((set, get) => ({
  selectedMissionItemId: null,
  activeTool: 'add-wp',
  drawingFence: false,
  toasts: [],
  alternativeRoutes: [],
  activeAlternativeId: null,
  constraintsPanelOpen: false,
  missionLibraryOpen: false,
  templatePickerOpen: false,
  timelineOpen: false,
  geofencePanelOpen: false,
  terrainPanelOpen: false,

  selectMissionItem: (itemId) => set({ selectedMissionItemId: itemId }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  toggleDrawingFence: () => set((state) => ({ drawingFence: !state.drawingFence })),
  setDrawingFence: (drawing) => set({ drawingFence: drawing }),
  resetSelection: () =>
    set({ selectedMissionItemId: null, activeTool: 'select', drawingFence: false }),

  addToast: (message, type = 'info') => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, 3500);
  },

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  setAlternativeRoutes: (routes) => set({ alternativeRoutes: routes }),
  clearAlternativeRoutes: () =>
    set({ alternativeRoutes: [], activeAlternativeId: null }),
  setActiveAlternative: (id) => set({ activeAlternativeId: id }),

  toggleConstraintsPanel: () =>
    set((state) => ({ constraintsPanelOpen: !state.constraintsPanelOpen })),
  toggleMissionLibrary: () =>
    set((state) => ({ missionLibraryOpen: !state.missionLibraryOpen })),
  toggleTemplatePicker: () =>
    set((state) => ({ templatePickerOpen: !state.templatePickerOpen })),
  toggleTimeline: () =>
    set((state) => ({ timelineOpen: !state.timelineOpen })),
  toggleGeofencePanel: () =>
    set((state) => ({ geofencePanelOpen: !state.geofencePanelOpen })),
  toggleTerrainPanel: () =>
    set((state) => ({ terrainPanelOpen: !state.terrainPanelOpen })),
  setMissionLibraryOpen: (open) => set({ missionLibraryOpen: open }),
  setTemplatePickerOpen: (open) => set({ templatePickerOpen: open }),
}));
