'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AttributionControl,
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  type FilterSpecification,
  type StyleSpecification,
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
import { readMapColors, watchTheme, type MapColors } from './map-colors';
import {
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
import { Kbd } from '@/components/base/kbd/kbd';
import { DATA_MONO, FLOAT_PANEL, TONE_DOT } from '@/components/editor/editor-styles';
import { cx } from '@/utils/cx';
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

/** Every overlay layer id, bottom to top (used to remove and re-add them on a theme change). */
const OVERLAY_LAYERS = [
  'mp-zones-fill',
  'mp-zones-line-out',
  'mp-zones-line-in',
  'mp-preview-line',
  'mp-route-casing',
  'mp-route-home',
  'mp-route',
  'mp-draft-fill',
  'mp-draft-line',
  'mp-draft-points',
  'mp-wp-circle',
  'mp-wp-shape',
  'mp-wp-label',
] as const;

/** Layers a click or drag on a waypoint can hit. */
const WP_LAYERS = ['mp-wp-circle', 'mp-wp-shape'];

/**
 * Signed-distance-field glyph for the takeoff square and landing diamond, so a
 * single image can be tinted (icon-color) by selection state and haloed.
 * Encoding follows MapLibre/TinySDF: 8px radius, 0.25 cutoff.
 */
function shapeSdf(shape: 'square' | 'diamond', size = 32, half = 9): { width: number; height: number; data: Uint8Array } {
  const data = new Uint8Array(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x + 0.5 - c);
      const dy = Math.abs(y + 0.5 - c);
      const d = shape === 'square' ? Math.max(dx, dy) - half : (dx + dy) / Math.SQRT2 - half;
      const v = Math.max(0, Math.min(255, Math.round(255 - 255 * (d / 8 + 0.25))));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = v;
    }
  }
  return { width: size, height: size, data };
}

function removeOverlayLayers(map: MapLibreMap) {
  for (const id of OVERLAY_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
}

/** Adds every overlay source + layer (idempotent). Called on each style load so
 * overlays survive switching between the vector and satellite basemaps, and on a
 * theme change (after `removeOverlayLayers`) so colours follow the tokens. */
function installOverlays(map: MapLibreMap, c: MapColors) {
  const add = (id: string, promoteId?: string) => {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: emptyFC(), ...(promoteId && { promoteId }) });
  };
  add(SRC.zones, 'id');
  add(SRC.route);
  add(SRC.preview);
  add(SRC.draft);
  add(SRC.wps, 'id');
  if (!map.hasImage('mp-square')) map.addImage('mp-square', shapeSdf('square'), { sdf: true });
  if (!map.hasImage('mp-diamond')) map.addImage('mp-diamond', shapeSdf('diamond', 32, 10), { sdf: true });

  const layer = (spec: Parameters<MapLibreMap['addLayer']>[0]) => {
    if (!map.getLayer(spec.id)) map.addLayer(spec);
  };
  const expr = <T,>(e: unknown) => e as T;
  const selected = ['boolean', ['feature-state', 'selected'], false];
  const hover = ['boolean', ['feature-state', 'hover'], false];
  const keepIn = ['==', ['get', 'kind'], 'keep_in'];
  const disabled = ['==', ['get', 'enabled'], 0];
  const shaped = ['in', ['get', 'kind'], ['literal', ['takeoff', 'land']]];

  // Zones: keep-out / no-fly = danger 12% + dashed danger; keep-in = info 8% + info line.
  layer({
    id: 'mp-zones-fill',
    type: 'fill',
    source: SRC.zones,
    paint: {
      'fill-color': expr<string>(['case', keepIn, c.info, c.danger]),
      'fill-opacity': expr<number>([
        'case',
        disabled,
        0.03,
        selected,
        ['case', keepIn, 0.16, 0.22],
        hover,
        ['case', keepIn, 0.12, 0.17],
        ['case', keepIn, 0.08, 0.12],
      ]),
    },
  });
  layer({
    id: 'mp-zones-line-out',
    type: 'line',
    source: SRC.zones,
    filter: ['!=', ['get', 'kind'], 'keep_in'],
    paint: {
      'line-color': c.danger,
      'line-width': expr<number>(['case', selected, 2.5, 1.5]),
      'line-dasharray': [3, 2],
      'line-opacity': expr<number>(['case', disabled, 0.4, 1]),
    },
  });
  layer({
    id: 'mp-zones-line-in',
    type: 'line',
    source: SRC.zones,
    filter: keepIn as unknown as FilterSpecification,
    paint: {
      'line-color': c.info,
      'line-width': expr<number>(['case', selected, 2.5, 1.5]),
      'line-opacity': expr<number>(['case', disabled, 0.4, 1]),
    },
  });
  // Planner previews (survey passes, optimise / avoid route) in info.
  layer({
    id: 'mp-preview-line',
    type: 'line',
    source: SRC.preview,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': c.info,
      'line-width': expr<number>(['match', ['get', 'role'], 'pass', 1, 2]),
      'line-dasharray': [2, 1.5],
    },
  });
  // Route: accent 3px on a surface casing (1px each side) so it reads on satellite.
  layer({
    id: 'mp-route-casing',
    type: 'line',
    source: SRC.route,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': c.surface, 'line-width': expr<number>(['case', ['==', ['get', 'home'], 1], 4, 5]) },
  });
  layer({
    id: 'mp-route-home',
    type: 'line',
    source: SRC.route,
    filter: ['==', ['get', 'home'], 1],
    paint: { 'line-color': c.accent, 'line-width': 2, 'line-dasharray': [2, 2] },
  });
  layer({
    id: 'mp-route',
    type: 'line',
    source: SRC.route,
    filter: ['==', ['get', 'home'], 0],
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': expr<string>(['match', ['get', 'severity'], 'error', c.danger, c.accent]),
      'line-width': 3,
    },
  });
  // Drawing drafts (survey outline, zone, measure).
  layer({
    id: 'mp-draft-fill',
    type: 'fill',
    source: SRC.draft,
    filter: ['==', ['geometry-type'], 'Polygon'],
    paint: { 'fill-color': expr<string>(['coalesce', ['get', 'color'], c.ink2]), 'fill-opacity': 0.1 },
  });
  layer({
    id: 'mp-draft-line',
    type: 'line',
    source: SRC.draft,
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'Polygon']]],
    paint: { 'line-color': expr<string>(['coalesce', ['get', 'color'], c.ink2]), 'line-width': 1.5, 'line-dasharray': [3, 2] },
  });
  layer({
    id: 'mp-draft-points',
    type: 'circle',
    source: SRC.draft,
    filter: ['==', ['geometry-type'], 'Point'],
    paint: {
      'circle-radius': 4,
      'circle-color': c.surface,
      'circle-stroke-color': expr<string>(['coalesce', ['get', 'color'], c.ink2]),
      'circle-stroke-width': 1.5,
    },
  });
  // Waypoints: 22px surface circles with an ink ring; selected = accent fill.
  layer({
    id: 'mp-wp-circle',
    type: 'circle',
    source: SRC.wps,
    filter: ['!', shaped] as unknown as FilterSpecification,
    paint: {
      'circle-radius': expr<number>(['case', selected, 11, hover, 11, 10]),
      'circle-color': expr<string>(['case', selected, c.accent, c.surface]),
      'circle-stroke-width': expr<number>(['case', ['!=', ['get', 'severity'], ''], 2.5, 1.5]),
      'circle-stroke-color': expr<string>([
        'match',
        ['get', 'severity'],
        'error',
        c.danger,
        'warning',
        c.warn,
        ['case', selected, c.accent, c.ink],
      ]),
    },
  });
  // Takeoff = ink square, landing = ink diamond.
  layer({
    id: 'mp-wp-shape',
    type: 'symbol',
    source: SRC.wps,
    filter: shaped as unknown as FilterSpecification,
    layout: {
      'icon-image': expr<string>(['match', ['get', 'kind'], 'land', 'mp-diamond', 'mp-square']),
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-color': expr<string>(['case', selected, c.accent, c.ink]),
      'icon-halo-color': expr<string>(['match', ['get', 'severity'], 'error', c.danger, 'warning', c.warn, c.surface]),
      'icon-halo-width': 2,
    },
  });
  // Numbers are drawn as SDF images in Geist Mono (no glyph server needed), tinted by state.
  layer({
    id: 'mp-wp-label',
    type: 'symbol',
    source: SRC.wps,
    layout: {
      'icon-image': ['concat', 'mp-num-', ['get', 'label']],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-color': expr<string>(['case', selected, c.accentInk, shaped, c.surface, c.ink]) },
  });
}

/** Mono font stack from the design tokens (Geist Mono), for canvas-drawn labels. */
function monoFont(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim();
  return v || 'ui-monospace, monospace';
}

/**
 * Waypoint number as an SDF-ish image: text alpha drawn at 2x, boosted so the
 * 0.75 SDF edge sits near the glyph outline. Lets `icon-color` follow selection.
 */
function numberImage(label: string): { width: number; height: number; data: Uint8ClampedArray } | null {
  const ratio = 2;
  const w = Math.max(16, label.length * 8 + 4) * ratio;
  const h = 16 * ratio;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = `500 ${11 * ratio}px ${monoFont()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white';
  ctx.fillText(label, w / 2, h / 2 + ratio * 0.5);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = Math.min(255, Math.round(d[i + 3] * 1.35));
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = a;
  }
  return { width: w, height: h, data: d };
}

/** Offline basemap: a plain background so overlays still draw when the tile host is unreachable. */
function fallbackStyle(): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: 'fallback-bg', type: 'background', paint: { 'background-color': readMapColors().surface2 } }] };
}

function setData(map: MapLibreMap, id: string, data: FeatureCollection) {
  (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
}

const NO_DRAFT_INFO = { key: '', count: 0, lengthM: 0, radiusM: 0 };

export function MissionMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const homeMarkerRef = useRef<Marker | null>(null);
  const coordRef = useRef<HTMLSpanElement>(null);
  const styleLoadedRef = useRef(false);
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
    const color = tool === 'draw-zone' ? (zd.kind === 'keep_in' ? c.info : c.danger) : tool === 'draw-area' ? c.info : c.ink2;
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
      features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [[...area, area[0]]] }, properties: { color: c.info } });
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
    // Attribution stays visible bottom-right (MapLibre collapses it on narrow maps).
    map.addControl(new AttributionControl({}), 'bottom-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('style.load', () => {
      styleLoadedRef.current = true;
      colorsRef.current = colorsRef.current ?? readMapColors();
      installOverlays(map, colorsRef.current);
      setStyleNonce((n) => n + 1);
    });
    map.on('error', (e) => {
      const err = (e as { error?: { status?: number; message?: string } }).error;
      if (err && (!err.status || err.status >= 400)) {
        setTilesFailedFor(appliedStyleRef.current);
        // The vector style itself could not load: switch to a blank style so the
        // route, waypoints and zones still render.
        if (!styleLoadedRef.current) {
          styleLoadedRef.current = true;
          map.setStyle(fallbackStyle());
        }
      }
    });
    map.on('styleimagemissing', (e: { id: string }) => {
      const m = /^mp-num-(\d+)$/.exec(e.id);
      if (!m || map.hasImage(e.id)) return;
      const img = numberImage(m[1]);
      if (img) map.addImage(e.id, img, { sdf: true, pixelRatio: 2 });
    });
    map.on('moveend', () => {
      const c = map.getCenter();
      if (coordRef.current) coordRef.current.textContent = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
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

  // Theme change: re-read the token colours and re-add the overlay layers (sources,
  // their data and feature state are kept).
  useEffect(() => {
    return watchTheme(() => {
      const map = mapRef.current;
      colorsRef.current = readMapColors();
      if (!map || !map.isStyleLoaded()) return;
      if (map.getLayer('fallback-bg')) map.setPaintProperty('fallback-bg', 'background-color', colorsRef.current.surface2);
      removeOverlayLayers(map);
      installOverlays(map, colorsRef.current);
      renderDraft();
    });
  }, [renderDraft]);

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

  // Home marker: ink square with a surface ring (DOM, styled with token classes).
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
        'flex size-[22px] items-center justify-center rounded-[3px] bg-text-primary font-mono text-[11px] font-medium leading-none text-background-primary-default ring-[1.5px] ring-background-primary-default';
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
        const wp = hit(e, WP_LAYERS);
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
      if (coordRef.current) coordRef.current.textContent = `${e.lngLat.lat.toFixed(6)}, ${e.lngLat.lng.toFixed(6)}`;
      const tool = useUIStore.getState().activeTool;
      const d = draftRef.current;
      if (DRAWING_TOOLS.includes(tool) && (d.points.length > 0 || d.center)) {
        d.cursor = [e.lngLat.lng, e.lngLat.lat];
        if (d.center) setDraftState({ key: draftKeyRef.current,  count: 1, lengthM: 0, radiusM: haversineM(d.center, d.cursor) });
        else if (tool === 'measure') setDraftState({ key: draftKeyRef.current,  count: d.points.length, lengthM: pathLengthM([...d.points, d.cursor]), radiusM: 0 });
        renderDraft();
      }
      if (tool !== 'select' && tool !== 'add-wp') return;
      const f = hit(e, WP_LAYERS) ?? (tool === 'select' ? hit(e, ['mp-zones-fill']) : undefined);
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
      const f = hit(e, WP_LAYERS);
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
    <div
      className={cx(
        'relative h-full min-h-0 w-full overflow-hidden bg-background-secondary-default',
        // MapLibre's own controls: scale above the coordinate readout, quiet attribution.
        '[&_.maplibregl-ctrl-bottom-left]:bottom-7!',
        '[&_.maplibregl-ctrl-scale]:border-text-tertiary! [&_.maplibregl-ctrl-scale]:bg-background-primary-default/80! [&_.maplibregl-ctrl-scale]:font-mono! [&_.maplibregl-ctrl-scale]:text-[10px]! [&_.maplibregl-ctrl-scale]:text-text-secondary!',
        '[&_.maplibregl-ctrl-attrib]:bg-background-primary-default/85! [&_.maplibregl-ctrl-attrib]:text-[10px]! [&_.maplibregl-ctrl-attrib]:text-text-tertiary! [&_.maplibregl-ctrl-attrib_a]:text-text-secondary!'
      )}
    >
      <div ref={containerRef} className="absolute inset-0 size-full" aria-label="Mission map" role="application" />
      <ToolHint info={draftInfo} onFinish={finishDraft} onCancel={cancelDraft} />
      {empty && activeTool === 'select' && (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4">
          <p className={cx(FLOAT_PANEL, 'px-3 py-2 text-[13px] text-text-secondary')}>
            No waypoints yet. Press <Kbd>A</Kbd> and click the map, or outline a survey area with <Kbd>P</Kbd>.
          </p>
        </div>
      )}
      {tilesFailedFor === mapStyle && (
        <div role="status" className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center px-4">
          <p className={cx(FLOAT_PANEL, 'flex items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary')}>
            <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', TONE_DOT.warn)} />
            Basemap tiles could not load. Editing still works; try {mapStyle === 'satellite' ? 'the map' : 'satellite'} on the tool rail.
          </p>
        </div>
      )}
      <p
        aria-hidden
        className={cx(
          DATA_MONO,
          'pointer-events-none absolute bottom-2 left-2 z-[2] rounded-[4px] bg-background-primary-default/85 px-1.5 py-0.5 text-[11px] leading-4 text-text-secondary'
        )}
      >
        <span ref={coordRef}>–</span>
      </p>
      <MapChrome mapRef={mapRef} />
      {contextMenu && <MapContextMenu state={contextMenu} onClose={() => setContextMenu(null)} />}
    </div>
  );
}
