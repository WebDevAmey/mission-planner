'use client';

import { create } from 'zustand';
import type { ZoneKind } from '@/lib/store/editor-types';

/** Editor tools on the left rail (PRODUCT_SPEC §6.2). */
export type MapTool = 'select' | 'add-wp' | 'draw-area' | 'draw-zone' | 'set-home' | 'measure';

export type InspectorTab = 'waypoints' | 'item' | 'checks' | 'settings';

export type PlanPanel = 'survey' | 'optimise' | 'avoid' | null;

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  /** Optional action button (e.g. Undo). */
  action?: { label: string; onClick: () => void };
}

/** A route preview drawn on the map while a planner dialog is open. */
export interface MapPreview {
  /** Flight path to draw, [lng, lat]. */
  path: [number, number][];
  /** Optional survey passes (drawn thinner). */
  lines?: [[number, number], [number, number]][];
}

/** One-shot camera request consumed by the map (nonce makes repeats fire). */
export interface MapFocus {
  nonce: number;
  kind: 'route' | 'point' | 'bounds';
  point?: [number, number];
  bounds?: [[number, number], [number, number]];
}

interface UIStoreState {
  selectedMissionItemId: string | null;
  selectedZoneId: string | null;
  activeTool: MapTool;
  zoneDraft: { shape: 'polygon' | 'circle'; kind: ZoneKind };
  inspectorTab: InspectorTab;
  /** Desktop: inspector shown. Below 1280px it is an overlay drawer, closed by default. */
  inspectorOpen: boolean;
  paramTableOpen: boolean;
  terrainOpen: boolean;
  templatePickerOpen: boolean;
  shortcutsOpen: boolean;
  planPanel: PlanPanel;
  /** Polygon drawn with the Draw area tool, consumed by the Survey planner. */
  surveyArea: [number, number][] | null;
  preview: MapPreview | null;
  mapStyle: 'vector' | 'satellite';
  mapFocus: MapFocus | null;
  /** Last map centre/zoom, so tools without a location (templates) can use it. */
  mapView: { lat: number; lng: number; zoom: number } | null;
  toasts: Toast[];

  selectMissionItem: (itemId: string | null) => void;
  selectZone: (zoneId: string | null) => void;
  setActiveTool: (tool: MapTool) => void;
  setZoneDraft: (draft: Partial<UIStoreState['zoneDraft']>) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setParamTableOpen: (open: boolean) => void;
  setTerrainOpen: (open: boolean) => void;
  setTemplatePickerOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  openPlanPanel: (panel: PlanPanel) => void;
  setSurveyArea: (area: [number, number][] | null) => void;
  setPreview: (preview: MapPreview | null) => void;
  setMapStyle: (style: 'vector' | 'satellite') => void;
  focusMap: (focus: Omit<MapFocus, 'nonce'>) => void;
  setMapView: (view: { lat: number; lng: number; zoom: number }) => void;
  resetSelection: () => void;
  addToast: (message: string, type?: Toast['type'], action?: Toast['action']) => void;
  removeToast: (id: string) => void;
}

let toastCounter = 0;
let focusNonce = 0;

export const useUIStore = create<UIStoreState>((set, get) => ({
  selectedMissionItemId: null,
  selectedZoneId: null,
  activeTool: 'select',
  zoneDraft: { shape: 'polygon', kind: 'keep_out' },
  inspectorTab: 'waypoints',
  inspectorOpen: true,
  paramTableOpen: false,
  terrainOpen: false,
  templatePickerOpen: false,
  shortcutsOpen: false,
  planPanel: null,
  surveyArea: null,
  preview: null,
  mapStyle: 'vector',
  mapFocus: null,
  mapView: null,
  toasts: [],

  selectMissionItem: (itemId) => set({ selectedMissionItemId: itemId, selectedZoneId: itemId ? null : get().selectedZoneId }),
  selectZone: (zoneId) => set({ selectedZoneId: zoneId, selectedMissionItemId: zoneId ? null : get().selectedMissionItemId }),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoneDraft: (draft) => set((s) => ({ zoneDraft: { ...s.zoneDraft, ...draft } })),
  setInspectorTab: (tab) => set({ inspectorTab: tab, inspectorOpen: true }),
  setInspectorOpen: (open) => set({ inspectorOpen: open }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setParamTableOpen: (open) => set({ paramTableOpen: open }),
  setTerrainOpen: (open) => set({ terrainOpen: open }),
  setTemplatePickerOpen: (open) => set({ templatePickerOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  openPlanPanel: (panel) =>
    set(panel ? { planPanel: panel, preview: null, inspectorTab: 'waypoints', inspectorOpen: true } : { planPanel: null, preview: null }),
  setSurveyArea: (area) => set({ surveyArea: area }),
  setPreview: (preview) => set({ preview }),
  setMapStyle: (style) => set({ mapStyle: style }),
  focusMap: (focus) => set({ mapFocus: { ...focus, nonce: ++focusNonce } }),
  setMapView: (view) => set({ mapView: view }),
  resetSelection: () => set({ selectedMissionItemId: null, selectedZoneId: null }),

  addToast: (message, type = 'info', action) => {
    const id = `toast-${++toastCounter}`;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { id, message, type, action }] }));
    setTimeout(() => get().removeToast(id), type === 'error' ? 8000 : 4000);
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
