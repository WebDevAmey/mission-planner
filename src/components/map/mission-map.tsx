'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapMouseEvent,
  type MapTouchEvent,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore, type MapTool } from '@/lib/store/ui-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { PlannerAction } from '@/lib/mavlink/commands';
import { haversineM, type LngLat } from '@/lib/domain/geo';
import { round7 } from '@/lib/utils';
import { ZONE_KIND_LABEL } from '@/lib/store/editor-types';
import { getMapColors, type MapColors } from './map-colors';
import {
  LABEL_FONT,
  VECTOR_STYLE_URL,
  circleRing,
  emptyFC,
  missionBounds,
  pathLengthM,
  routeFeatures,
  satelliteStyle,
  waypointFeatures,
  zoneFeatures,
} from './map-geo';
import { MapChrome } from './map-chrome';
import { ToolHint } from './tool-hint';
import { MapContextMenu, type ContextMenuState } from './map-context-menu';

type Feature<G extends GeoJSON.Geometry | null = GeoJSON.Geometry> = GeoJSON.Feature<G>;
type FeatureCollection<G extends GeoJSON.Geometry | null = GeoJSON.Geometry> = GeoJSON.FeatureCollection<G>;
type Geometry = GeoJSON.Geometry;

const SRC = {
  zones: 'mp-zones',
  route: 'mp-route',
  wps: 'mp-waypoints',
  preview: 'mp-preview',
  draft: 'mp-draft',
} as const;

const LAST_VIEW_KEY = 'mps-map-last-view';
const DRAWING_TOOLS: MapTool[] = ['draw-area', 'draw-zone', 'measure'];

interface Draft {
  points: LngLat[];
  cursor: LngLat | null;
  /** Circle zones: centre after the first click. */
  center: LngLat | null;
}

const emptyDraft = (): Draft => ({ points: [], cursor: null, center: null });

function styleFor(kind: 'vector' | 'satellite') {
  return kind === 'satellite' ? satelliteStyle() : VECTOR_STYLE_URL;
}

function readLastView(): { center: [number, number]; zoom: number } | null {
  try {
    const raw = localStorage.getItem(LAST_VIEW_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { center: [number, number]; zoom: number };
    return Array.isArray(v.center) && Number.isFinite(v.zoom) ? v : null;
  } catch {
    return null;
  }
}

/** Adds every overlay source + layer (idempotent). Called on each style load so
 * overlays survive switching between the vector and satellite basemaps. */
function installOverlays(map: MapLibreMap, c: MapColors) {
  const add = (id: string, promoteId?: string) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: emptyFC(), ...(promoteId && { promoteId }) });
  };
  add(SRC.zones, 'id');
  add(SRC.route);
  add(SRC.preview);
  add(SRC.draft);
  add(SRC.wps, 'id');

  const layer = (spec: Parameters<MapLibreMap['addLayer']>[0]) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };
  const zoneColor = ['match', ['get', 'kind'], 'keep_in', c.keepIn, c.keepOut] as unknown as string;
  const selected = ['boolean', ['feature-state', 'selected'], false];
  const hover = ['boolean', ['feature-state', 'hover'], false];

  layer({
    id: 'mp-zones-fill',
    type: 'fill',
    source: SRC.zones,
    paint: {
      'fill-color': zoneColor,
      'fill-opacity': ['case', ['==', ['get', 'enabled'], 0], 0.04, selected, 0.28, hover, 0.2, 0.14] as unknown as number,
    },
  });
  layer({
    id: 'mp-zones-line',
    type: 'line',
    source: SRC.zones,
    paint: {
      'line-color': zoneColor,
      'line-width': ['case', selected, 3, 1.5] as unknown as number,
      'line-dasharray': [3, 2],
      'line-opacity': ['case', ['==', ['get', 'enabled'], 0], 0.4, 0.9] as unknown as number,
    },
  });
  layer({
    id: 'mp-preview-line',
    type: 'line',
    source: SRC.preview,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': c.preview,
      'line-width': ['match', ['get', 'role'], 'pass', 1.5, 3] as unknown as number,
      'line-dasharray': [2, 1.5],
      'line-opacity': 0.95,
    },
  });
  layer({
    id: 'mp-route',
    type: 'line',
    source: SRC.route,
    filter: ['==', ['get', 'home'], 0],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'severity'], 'error', c.routeError, c.route] as unknown as string,
      'line-width': 3,
      'line-opacity': 0.9,
    },
  });
  layer({
    id: 'mp-route-home',
    type: 'line',
    source: SRC.route,
    filter: ['==', ['get', 'home'], 1],
    paint: { 'line-color': c.route, 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.7 },
  });
  layer({
    id: 'mp-draft-fill',
    type: 'fill',
    source: SRC.draft,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': ['coalesce', ['get', 'color'], c.measure] as unknown as string, 'fill-opacity': 0.15 },
  });
  layer({
    id: 'mp-draft-line',
    type: 'line',
    source: SRC.draft,
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
    paint: { 'line-color': ['coalesce', ['get', 'color'], c.measure] as unknown as string, 'line-width': 2, 'line-dasharray': [2, 1] },
  });
  layer({
    id: 'mp-draft-points',
    type: 'circle',
    source: SRC.draft,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 5,
      'circle-color': ['coalesce', ['get', 'color'], c.measure] as unknown as string,
      'circle-stroke-color': c.halo,
      'circle-stroke-width': 2,
    },
  });
  layer({
    id: 'mp-wp-circle',
    type: 'circle',
    source: SRC.wps,
    paint: {
      'circle-radius': ['case', selected, 14, hover, 13, 11] as unknown as number,
      'circle-color': ['case', selected, c.selected, c.waypoint] as unknown as string,
      'circle-stroke-width': ['case', ['!=', ['get', 'severity'], ''], 3, 2] as unknown as number,
      'circle-stroke-color': [
        'match',
        ['get', 'severity'],
        'error',
        c.error,
        'warning',
        c.warning,
        c.halo,
      ] as unknown as string,
    },
  });
  layer({
    id: 'mp-wp-label',
    type: 'symbol',
    source: SRC.wps,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': LABEL_FONT,
      'text-size': 12,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': c.waypointText },
  });
}

function setData(map: MapLibreMap, id: string, data: FeatureCollection) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

const NO_DRAFT_INFO = { key: '', count: 0, lengthM: 0, radiusM: 0 };

export function MissionMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const homeMarkerRef = useRef<Marker | null>(null);
  const colorsRef = useRef<MapColors | null>(null);
  const draftRef = useRef<Draft>(emptyDraft());
  const dragRef = useRef<{ id: string; moved: boolean; pos: LngLat } | null>(null);
  const hoverRef = useRef<{ source: string; id: string } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const fittedRef = useRef<string | null>(null);
  const [styleNonce, setStyleNonce] = useState(0);
  const draftKeyRef = useRef('');
  const [draftState, setDraftState] = useState({ key: '', count: 0, lengthM: 0, radiusM: 0 });
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [tilesFailedFor, setTilesFailedFor] = useState<string | null>(null);

  const mission = useMissionStore((s) => s.mission);
  const analysis = useMissionAnalysis();
  const selectedItemId = useUIStore((s) => s.selectedMissionItemId);
  const selectedZoneId = useUIStore((s) => s.selectedZoneId);
  const activeTool = useUIStore((s) => s.activeTool);
  const zoneDraft = useUIStore((s) => s.zoneDraft);
  const preview = useUIStore((s) => s.preview);
  const surveyArea = useUIStore((s) => s.surveyArea);
  const mapStyle = useUIStore((s) => s.mapStyle);
  const appliedStyleRef = useRef(mapStyle);
  const draftInfo = draftState.key === `${activeTool}:${zoneDraft.shape}` ? draftState : NO_DRAFT_INFO;
  const mapFocus = useUIStore((s) => s.mapFocus);

  /* ------------------------------------------------------------ rendering */

  const renderDraft = useCallback(() => {
    const map = mapRef.current;
    const c = colorsRef.current;
    if (!map || !c || !map.getSource(SRC.draft)) return;
    const { activeTool: tool, zoneDraft: zd, surveyArea: area } = useUIStore.getState();
    const d = draftRef.current;
    const color = tool === 'draw-zone' ? (zd.kind === 'keep_in' ? c.keepIn : c.keepOut) : tool === 'draw-area' ? c.preview : c.measure;
    const features: Feature<Geometry>[] = [];

    if (tool === 'draw-zone' && zd.shape === 'circle' && d.center) {
      const r = d.cursor ? haversineM(d.center, d.cursor) : 0;
      if (r > 0) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circleRing(d.center, r)] }, properties: { color } });
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: d.center }, properties: { color } });
    } else if (d.points.length > 0) {
      const line = d.cursor ? [...d.points, d.cursor] : d.points;
      const closed = tool !== 'measure' && line.length >= 3;
      if (closed) {
        features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...line, line[0]]] }, properties: { color } });
      } else if (line.length >= 2) {
        features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: line }, properties: { color } });
      }
      d.points.forEach((p) => features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: p }, properties: { color } }));
    }
    // A finished survey area stays visible while the survey planner is open.
    if (area && area.length >= 3 && d.points.length === 0) {
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...area, area[0]]] }, properties: { color: c.preview } });
    }
    setData(map, SRC.draft, { type: 'FeatureCollection', features });
  }, []);

  const renderPreview = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(SRC.preview)) return;
    const p = useUIStore.getState().preview;
    const features: Feature<Geometry>[] = [];
    if (p) {
      p.lines?.forEach((l) => features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: l }, properties: { role: 'pass' } }));
      if (p.path.length >= 2) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: p.path }, properties: { role: 'path' } });
    }
    setData(map, SRC.preview, { type: 'FeatureCollection', features });
  }, []);

  const applySelection = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(SRC.wps)) return;
    const { selectedMissionItemId, selectedZoneId: zoneId } = useUIStore.getState();
    map.removeFeatureState({ source: SRC.wps });
    map.removeFeatureState({ source: SRC.zones });
    if (selectedMissionItemId) map.setFeatureState({ source: SRC.wps, id: selectedMissionItemId }, { selected: true });
    if (zoneId) map.setFeatureState({ source: SRC.zones, id: zoneId }, { selected: true });
    const h = hoverRef.current;
    if (h) map.setFeatureState({ source: h.source, id: h.id }, { hover: true });
  }, []);

  /* ------------------------------------------------------------ init */

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const last = readLastView();
    const map = new MapLibreMap({
      container: containerRef.current,
      style: styleFor(useUIStore.getState().mapStyle),
      center: last?.center ?? [0, 20],
      zoom: last?.zoom ?? 2,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('style.load', () => {
      colorsRef.current = colorsRef.current ?? getMapColors();
      installOverlays(map, colorsRef.current);
      setStyleNonce((n) => n + 1);
    });
    map.on('error', (e) => {
      const err = (e as { error?: { status?: number; message?: string } }).error;
      if (err && (err.status === undefined || err.status >= 400)) setTilesFailedFor(appliedStyleRef.current);
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      const zoom = map.getZoom();
      useUIStore.getState().setMapView({ lat: c.lat, lng: c.lng, zoom });
      try {
        localStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ center: [c.lng, c.lat], zoom }));
      } catch {
        // storage unavailable: last view is a convenience only
      }
    });

    return () => {
      homeMarkerRef.current?.remove();
      homeMarkerRef.current = null;
      mapRef.current = null;
      // Removing the map before its first style load crashes MapLibre; defer.
      if (map.loaded()) map.remove();
      else {
        map.once('load', () => map.remove());
        map.once('error', () => map.remove());
      }
    };
  }, []);

  // Basemap switch: overlays are re-added by the style.load handler.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedStyleRef.current === mapStyle) return;
    appliedStyleRef.current = mapStyle;
    map.setStyle(styleFor(mapStyle));
  }, [mapStyle]);

  /* ------------------------------------------------------------ data */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mission || !analysis || !map.getSource(SRC.wps)) return;
    if (dragRef.current?.moved) return; // the drag owns the waypoint source until mouseup
    setData(map, SRC.zones, zoneFeatures(mission.zones));
    setData(map, SRC.route, routeFeatures(mission, analysis.issues));
    setData(map, SRC.wps, waypointFeatures(mission, analysis.issues));
    applySelection();
  }, [mission, analysis, styleNonce, applySelection]);

  useEffect(() => {
    applySelection();
  }, [selectedItemId, selectedZoneId, applySelection]);

  useEffect(() => {
    renderPreview();
  }, [preview, styleNonce, renderPreview]);

  useEffect(() => {
    renderDraft();
  }, [surveyArea, styleNonce, renderDraft]);

  // Reset drafts when the tool (or zone shape) changes.
  useEffect(() => {
    draftRef.current = emptyDraft();
    draftKeyRef.current = `${activeTool}:${zoneDraft.shape}`;
    renderDraft();
    const map = mapRef.current;
    if (!map) return;
    if (DRAWING_TOOLS.includes(activeTool)) map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    const canvas = map.getCanvas();
    canvas.style.cursor = activeTool === 'select' ? '' : 'crosshair';
  }, [activeTool, zoneDraft.shape, renderDraft]);

  // Home marker (DOM, styled with tokens via class names).
  useEffect(() => {
    const map = mapRef.current;
    const home = mission?.homePosition;
    if (!map) return;
    if (!home) {
      homeMarkerRef.current?.remove();
      homeMarkerRef.current = null;
      return;
    }
    if (!homeMarkerRef.current) {
      const el = document.createElement('div');
      el.className =
        'flex size-7 items-center justify-center rounded-full border-2 border-amber bg-bg-base text-caption-1-bold text-amber shadow-lg';
      el.textContent = 'H';
      el.setAttribute('aria-label', 'Home position');
      el.title = 'Home';
      homeMarkerRef.current = new Marker({ element: el }).setLngLat([home.longitude, home.latitude]).addTo(map);
    } else {
      homeMarkerRef.current.setLngLat([home.longitude, home.latitude]);
    }
  }, [mission?.homePosition, styleNonce]);

  // Initial camera: fit route -> home -> last view (once per mission).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mission || styleNonce === 0 || fittedRef.current === mission.id) return;
    fittedRef.current = mission.id;
    const bounds = missionBounds(mission);
    if (bounds) {
      const single = bounds[0][0] === bounds[1][0] && bounds[0][1] === bounds[1][1];
      if (single) map.jumpTo({ center: bounds[0], zoom: 15 });
      else map.fitBounds(bounds, { padding: 80, duration: 0, maxZoom: 17 });
    }
  }, [mission, styleNonce]);

  // One-shot camera requests from the rest of the editor.
  useEffect(() => {
    const map = mapRef.current;
    const m = useMissionStore.getState().mission;
    if (!map || !mapFocus) return;
    if (mapFocus.kind === 'route' && m) {
      const b = missionBounds(m);
      if (b) map.fitBounds(b, { padding: 80, duration: 500, maxZoom: 17 });
    } else if (mapFocus.kind === 'point' && mapFocus.point) {
      map.easeTo({ center: mapFocus.point, duration: 400, zoom: Math.max(map.getZoom(), 14) });
    } else if (mapFocus.kind === 'bounds' && mapFocus.bounds) {
      map.fitBounds(mapFocus.bounds, { padding: 80, duration: 500, maxZoom: 17 });
    }
  }, [mapFocus]);

  /* ------------------------------------------------------------ drawing */

  const finishDraft = useCallback(() => {
    const ui = useUIStore.getState();
    const store = useMissionStore.getState();
    const d = draftRef.current;
    const tool = ui.activeTool;

    if (tool === 'draw-area' && d.points.length >= 3) {
      ui.setSurveyArea(d.points.map(([lng, lat]) => [round7(lng), round7(lat)] as [number, number]));
      ui.openPlanPanel('survey');
      ui.setActiveTool('select');
    } else if (tool === 'draw-zone') {
      const { kind, shape } = ui.zoneDraft;
      const n = (store.mission?.zones.length ?? 0) + 1;
      const label = `${ZONE_KIND_LABEL[kind]} ${n}`;
      let id: string | null = null;
      if (shape === 'circle' && d.center && d.cursor) {
        const r = Math.round(haversineM(d.center, d.cursor));
        if (r < 5) return;
        id = store.addZone({ kind, shape, label, enabled: true, centerLat: round7(d.center[1]), centerLng: round7(d.center[0]), radiusM: r, vertices: null });
      } else if (shape === 'polygon' && d.points.length >= 3) {
        id = store.addZone({
          kind,
          shape,
          label,
          enabled: true,
          centerLat: null,
          centerLng: null,
          radiusM: null,
          vertices: d.points.map(([lng, lat]) => [round7(lng), round7(lat)] as [number, number]),
        });
      } else return;
      if (id) {
        ui.selectZone(id);
        ui.addToast(`${label} added`, 'success', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
      }
      ui.setActiveTool('select');
    } else return;

    draftRef.current = emptyDraft();
    setDraftState({ key: draftKeyRef.current,  count: 0, lengthM: 0, radiusM: 0 });
    renderDraft();
  }, [renderDraft]);

  const cancelDraft = useCallback(() => {
    const d = draftRef.current;
    if (d.points.length === 0 && !d.center) {
      useUIStore.getState().setActiveTool('select');
      return;
    }
    draftRef.current = emptyDraft();
    setDraftState({ key: draftKeyRef.current,  count: 0, lengthM: 0, radiusM: 0 });
    renderDraft();
  }, [renderDraft]);

  // Enter / Esc / Backspace while drawing.
  useEffect(() => {
    if (!DRAWING_TOOLS.includes(activeTool) && activeTool !== 'add-wp' && activeTool !== 'set-home') return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelDraft();
      } else if (e.key === 'Enter' && DRAWING_TOOLS.includes(activeTool)) {
        e.preventDefault();
        finishDraft();
      } else if (e.key === 'Backspace' && draftRef.current.points.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        draftRef.current.points.pop();
        const pts = draftRef.current.points;
        setDraftState({ key: draftKeyRef.current,  count: pts.length, lengthM: pathLengthM(pts), radiusM: 0 });
        renderDraft();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activeTool, cancelDraft, finishDraft, renderDraft]);

  /* ------------------------------------------------------------ pointer */

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hit = (e: MapMouseEvent | MapTouchEvent, layers: string[]): MapGeoJSONFeature | undefined => {
      const existing = layers.filter((l) => map.getLayer(l));
      if (existing.length === 0) return undefined;
      const { x, y } = e.point;
      return map.queryRenderedFeatures([[x - 4, y - 4], [x + 4, y + 4]], { layers: existing })[0];
    };

    const onClick = (e: MapMouseEvent) => {
      setContextMenu(null);
      if (dragRef.current || Date.now() < suppressClickUntilRef.current) return;
      const ui = useUIStore.getState();
      const store = useMissionStore.getState();
      const m = store.mission;
      if (!m) return;
      const pos: LngLat = [e.lngLat.lng, e.lngLat.lat];
      const tool = ui.activeTool;
      const d = draftRef.current;

      if (tool === 'select' || tool === 'add-wp') {
        const wp = hit(e, ['mp-wp-circle']);
        if (wp) {
          ui.selectMissionItem(String(wp.properties.id));
          if (ui.inspectorTab !== 'item') ui.setInspectorTab('item');
          return;
        }
        if (tool === 'add-wp') {
          const id = store.addMissionItem(PlannerAction.WAYPOINT, {
            coordinate: { latitude: round7(pos[1]), longitude: round7(pos[0]), altitude: m.settings.defaultAltitude },
          });
          if (id) ui.selectMissionItem(id);
          return;
        }
        const zone = hit(e, ['mp-zones-fill']);
        if (zone) {
          ui.selectZone(String(zone.properties.id));
          ui.setInspectorTab('settings');
          return;
        }
        ui.resetSelection();
        return;
      }
      if (tool === 'set-home') {
        store.setHomePosition({ latitude: round7(pos[1]), longitude: round7(pos[0]), altitude: 0 });
        ui.addToast('Home position set', 'success', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
        ui.setActiveTool('select');
        return;
      }
      if (tool === 'draw-zone' && ui.zoneDraft.shape === 'circle') {
        if (!d.center) {
          d.center = pos;
          d.cursor = pos;
        } else {
          d.cursor = pos;
          finishDraft();
          return;
        }
        renderDraft();
        return;
      }
      if (DRAWING_TOOLS.includes(tool)) {
        // Clicking the first vertex closes a polygon.
        if (tool !== 'measure' && d.points.length >= 3) {
          const first = map.project(d.points[0]);
          if (Math.hypot(first.x - e.point.x, first.y - e.point.y) < 12) {
            finishDraft();
            return;
          }
        }
        d.points.push(pos);
        setDraftState({ key: draftKeyRef.current,  count: d.points.length, lengthM: pathLengthM(d.points), radiusM: 0 });
        renderDraft();
      }
    };

    const onDblClick = (e: MapMouseEvent) => {
      const tool = useUIStore.getState().activeTool;
      if (tool === 'draw-area' || (tool === 'draw-zone' && useUIStore.getState().zoneDraft.shape === 'polygon')) {
        e.preventDefault();
        // The second click of the double-click already added a duplicate vertex.
        const pts = draftRef.current.points;
        if (pts.length >= 2) {
          const [a, b] = [pts[pts.length - 1], pts[pts.length - 2]];
          if (haversineM(a, b) < 0.5) pts.pop();
        }
        finishDraft();
      }
    };

    const onMove = (e: MapMouseEvent) => {
      const tool = useUIStore.getState().activeTool;
      const d = draftRef.current;
      if (DRAWING_TOOLS.includes(tool) && (d.points.length > 0 || d.center)) {
        d.cursor = [e.lngLat.lng, e.lngLat.lat];
        if (d.center) setDraftState({ key: draftKeyRef.current,  count: 1, lengthM: 0, radiusM: haversineM(d.center, d.cursor) });
        else if (tool === 'measure') setDraftState({ key: draftKeyRef.current,  count: d.points.length, lengthM: pathLengthM([...d.points, d.cursor]), radiusM: 0 });
        renderDraft();
      }
      if (tool !== 'select' && tool !== 'add-wp') return;
      const f = hit(e, ['mp-wp-circle']) ?? (tool === 'select' ? hit(e, ['mp-zones-fill']) : undefined);
      const next = f ? { source: f.source, id: String(f.properties.id) } : null;
      const prev = hoverRef.current;
      if (prev?.id === next?.id) return;
      if (prev) map.setFeatureState({ source: prev.source, id: prev.id }, { hover: false });
      if (next) map.setFeatureState({ source: next.source, id: next.id }, { hover: true });
      hoverRef.current = next;
      map.getCanvas().style.cursor = next ? 'pointer' : tool === 'add-wp' ? 'crosshair' : '';
    };

    /* drag waypoints directly on the layer */
    const startDrag = (e: MapMouseEvent | MapTouchEvent) => {
      const tool = useUIStore.getState().activeTool;
      if (tool !== 'select' && tool !== 'add-wp') return;
      if ('points' in e && e.points.length > 1) return;
      const f = hit(e, ['mp-wp-circle']);
      if (!f) return;
      e.preventDefault();
      dragRef.current = { id: String(f.properties.id), moved: false, pos: [e.lngLat.lng, e.lngLat.lat] };
      map.dragPan.disable();
      map.getCanvas().style.cursor = 'grabbing';
    };
    const moveDrag = (e: MapMouseEvent | MapTouchEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.moved = true;
      drag.pos = [e.lngLat.lng, e.lngLat.lat];
      const m = useMissionStore.getState().mission;
      if (!m) return;
      const items = m.items.map((it) => (it.id === drag.id ? { ...it, longitude: drag.pos[0], latitude: drag.pos[1] } : it));
      const temp = { ...m, items };
      setData(map, SRC.wps, waypointFeatures(temp, []));
      setData(map, SRC.route, routeFeatures(temp, []));
      applySelection();
    };
    const endDrag = () => {
      const drag = dragRef.current;
      if (!drag) return;
      map.dragPan.enable();
      map.getCanvas().style.cursor = '';
      dragRef.current = null;
      if (drag.moved) {
        suppressClickUntilRef.current = Date.now() + 80;
        useMissionStore.getState().updateMissionItem(drag.id, { latitude: round7(drag.pos[1]), longitude: round7(drag.pos[0]) });
        useUIStore.getState().selectMissionItem(drag.id);
      }
    };

    const onContext = (e: MapMouseEvent) => {
      e.preventDefault();
      const rect = map.getContainer().getBoundingClientRect();
      setContextMenu({ x: e.point.x, y: e.point.y, lngLat: [e.lngLat.lng, e.lngLat.lat], width: rect.width, height: rect.height });
    };

    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    map.on('mousemove', onMove);
    map.on('mousedown', startDrag);
    map.on('touchstart', startDrag);
    map.on('mousemove', moveDrag);
    map.on('touchmove', moveDrag);
    map.on('mouseup', endDrag);
    map.on('touchend', endDrag);
    map.on('contextmenu', onContext);
    return () => {
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
      map.off('mousemove', onMove);
      map.off('mousedown', startDrag);
      map.off('touchstart', startDrag);
      map.off('mousemove', moveDrag);
      map.off('touchmove', moveDrag);
      map.off('mouseup', endDrag);
      map.off('touchend', endDrag);
      map.off('contextmenu', onContext);
    };
  }, [finishDraft, renderDraft, applySelection]);

  const empty = !!mission && mission.items.length === 0;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-bg-raised">
      <div ref={containerRef} className="absolute inset-0" aria-label="Mission map" role="application" />
      <ToolHint info={draftInfo} onFinish={finishDraft} onCancel={cancelDraft} />
      {empty && activeTool === 'select' && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4">
          <p className="rounded-lg border border-border-button-default bg-background-primary-default/95 px-4 py-2 text-body-2-regular text-text-secondary shadow-dropdown">
            No waypoints yet. Press <kbd className="font-sans font-semibold text-text-primary">A</kbd> and click the map, or draw a survey area with{' '}
            <kbd className="font-sans font-semibold text-text-primary">P</kbd>.
          </p>
        </div>
      )}
      {tilesFailedFor === mapStyle && (
        <div role="status" className="absolute inset-x-0 bottom-12 flex justify-center px-4">
          <p className="rounded-lg border border-amber/40 bg-amber-bg px-3 py-1.5 text-body-2-medium text-amber">
            Map tiles could not load. Editing still works; try the other basemap in Layers.
          </p>
        </div>
      )}
      <MapChrome mapRef={mapRef} />
      {contextMenu && <MapContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}
