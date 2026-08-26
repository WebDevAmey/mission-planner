'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Map as MapLibreMap,
  Marker,
  ScaleControl,
  NavigationControl,
  type MapMouseEvent,
  type LngLatBoundsLike,
} from 'maplibre-gl';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { PlannerAction, supportsCoordinates } from '@/lib/mavlink/commands';
import { computeSegmentRisks } from '@/lib/services/risk-scorer';
import { haversineDistance, round7 } from '@/lib/utils';
import {
  ZoomIn,
  ZoomOut,
  Satellite,
  Map as MapIcon,
  MapPin,
  Home,
  Navigation2,
  Maximize2,
  Search,
  LoaderCircle,
  X,
} from 'lucide-react';

const VECTOR_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const SATELLITE_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

interface ContextMenu {
  x: number;
  y: number;
  lngLat: { lat: number; lng: number };
}

interface LocationSearchResult {
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
}

function buildSatelliteStyle() {
  return {
    version: 8 as const,
    sources: {
      satellite: {
        type: 'raster' as const,
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        attribution: 'Esri World Imagery',
        maxzoom: 19,
      },
    },
    layers: [
      {
        id: 'satellite',
        type: 'raster' as const,
        source: 'satellite',
      },
    ],
  };
}

function generateNfzCircleGeoJSON(
  lat: number,
  lng: number,
  radiusM: number,
  steps = 64
): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const earthR = 6371000;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / earthR) * (180 / Math.PI) * Math.cos(angle);
    const dLng =
      (radiusM / (earthR * Math.cos((lat * Math.PI) / 180))) *
      (180 / Math.PI) *
      Math.sin(angle);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const homeMarkerRef = useRef<Marker | null>(null);
  const recentlyAddedRef = useRef<string | null>(null);
  const isDraggingRef = useRef(false);

  const [mapStyle, setMapStyle] = useState<'vector' | 'satellite'>('vector');
  const [mapReady, setMapReady] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [nfzPopover, setNfzPopover] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [nfzRadius, setNfzRadius] = useState('500');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const { mission, addMissionItem, deleteMissionItem, updateMissionItem, setHomePosition } =
    useMissionStore();
  const { selectedMissionItemId, activeTool, selectMissionItem, addToast } = useUIStore();
  const { nfzs, config, addNfz, selectNfz, selectedNfzId, deleteNfz } =
    useConstraintsStore();

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: VECTOR_STYLE,
      center: [0, 0],
      zoom: 3,
      attributionControl: false,
    });

    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.addControl(new NavigationControl(), 'top-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;

    return () => {
      const mapInstance = mapRef.current;
      mapRef.current = null;
      markersRef.current = [];
      if (!mapInstance) return;

      let disposed = false;
      const dispose = () => {
        if (disposed) return;
        disposed = true;
        try {
          mapInstance.remove();
        } catch {
          // already destroyed
        }
      };

      // Removing the map before its initial style finishes loading makes
      // maplibre crash in migrateProjection ("reading 'projection'"), so
      // defer destruction until the style settles.
      if (mapInstance.loaded()) {
        dispose();
      } else {
        mapInstance.once('load', dispose);
        mapInstance.once('error', dispose);
      }
    };
  }, []);

  // Style toggle
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    if (mapStyle === 'satellite') {
      mapRef.current.setStyle(buildSatelliteStyle() as Parameters<MapLibreMap['setStyle']>[0]);
    } else {
      mapRef.current.setStyle(VECTOR_STYLE);
    }
    mapRef.current.once('styledata', () => setMapReady(true));
  }, [mapReady, mapStyle]);

  // Cursor style
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const canvas = mapRef.current.getCanvas();
    if (activeTool === 'add-wp') canvas.style.cursor = 'cell';
    else if (activeTool === 'remove-wp') canvas.style.cursor = 'not-allowed';
    else if (activeTool === 'draw-circle') canvas.style.cursor = 'crosshair';
    else if (activeTool === 'measure' || activeTool === 'draw-polygon') canvas.style.cursor = 'crosshair';
    else canvas.style.cursor = '';
  }, [activeTool, mapReady]);

  // Map click/context menu handlers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mission) return;

    const handleClick = (event: MapMouseEvent) => {
      setContextMenu(null);
      setNfzPopover(null);

      if (activeTool === 'add-wp') {
        const newId = addMissionItem(PlannerAction.WAYPOINT, {
          coordinate: {
            latitude: round7(event.lngLat.lat),
            longitude: round7(event.lngLat.lng),
            altitude: mission.settings.defaultAltitude,
          },
        });
        if (newId) {
          recentlyAddedRef.current = newId;
          setTimeout(() => {
            recentlyAddedRef.current = null;
          }, 600);
          addToast('Waypoint added', 'success');
        }
        return;
      }

      if (activeTool === 'set-home') {
        setHomePosition({
          latitude: round7(event.lngLat.lat),
          longitude: round7(event.lngLat.lng),
          altitude: mission.settings.defaultAltitude,
        });
        addToast('Home position set', 'success');
        return;
      }

      if (activeTool === 'draw-circle') {
        const nativeEvent = event.originalEvent as MouseEvent;
        setNfzPopover({
          x: nativeEvent.clientX,
          y: nativeEvent.clientY,
          lat: round7(event.lngLat.lat),
          lng: round7(event.lngLat.lng),
        });
        return;
      }
    };

    const handleContextMenu = (event: MapMouseEvent) => {
      event.preventDefault();
      const nativeEvent = event.originalEvent as MouseEvent;
      setContextMenu({
        x: nativeEvent.clientX,
        y: nativeEvent.clientY,
        lngLat: { lat: round7(event.lngLat.lat), lng: round7(event.lngLat.lng) },
      });
    };

    map.on('click', handleClick);
    map.on('contextmenu', handleContextMenu);
    return () => {
      map.off('click', handleClick);
      map.off('contextmenu', handleContextMenu);
    };
  }, [activeTool, addMissionItem, mapReady, mission, setHomePosition, addToast]);

  // flyTo selected item
  useEffect(() => {
    if (!mapRef.current || !mapReady || !selectedMissionItemId || !mission) return;
    const item = mission.items.find((i) => i.id === selectedMissionItemId);
    if (!item || item.latitude === null || item.longitude === null) return;
    mapRef.current.flyTo({
      center: [item.longitude, item.latitude],
      duration: 300,
    });
  }, [selectedMissionItemId, mapReady, mission]);

  // Render markers and route line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !mission) return;

    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const spatialItems = mission.items.filter(
      (item) => supportsCoordinates(item.action) && item.latitude !== null && item.longitude !== null
    );
    const coordinates = spatialItems.map(
      (item) => [item.longitude ?? 0, item.latitude ?? 0] as [number, number]
    );

    // Segment risk coloring
    const segmentRisks = computeSegmentRisks(
      mission.items,
      config,
      nfzs
    );

    // Remove old route layers
    const layersToRemove = ['route-main', ...segmentRisks.map((_, i) => `route-seg-${i}`)];
    for (let attempt = 0; attempt < layersToRemove.length + 5; attempt++) {
      try {
        const layers = map.getStyle()?.layers ?? [];
        let removed = false;
        for (const l of layers) {
          if (l.id.startsWith('route-') || l.id.startsWith('nfz-')) {
            if (map.getLayer(l.id)) {
              map.removeLayer(l.id);
              removed = true;
            }
          }
        }
        if (!removed) break;
      } catch {
        break;
      }
    }
    const sources = Object.keys(map.getStyle()?.sources ?? {});
    for (const srcId of sources) {
      if (srcId.startsWith('route-') || srcId.startsWith('nfz-')) {
        try {
          if (map.getSource(srcId)) map.removeSource(srcId);
        } catch {
          // ignore
        }
      }
    }

    if (coordinates.length > 1) {
      if (segmentRisks.length > 0) {
        for (let i = 0; i < segmentRisks.length; i++) {
          const seg = segmentRisks[i];
          const srcId = `route-seg-${i}`;
          const from = spatialItems[seg.fromIdx];
          const to = spatialItems[seg.toIdx];
          if (!from || !to) continue;
          try {
            map.addSource(srcId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [from.longitude!, from.latitude!],
                    [to.longitude!, to.latitude!],
                  ],
                },
                properties: {},
              },
            });
            map.addLayer({
              id: srcId,
              type: 'line',
              source: srcId,
              paint: {
                'line-color': seg.color,
                'line-width': 2.5,
                'line-opacity': 0.9,
              },
            });
          } catch {
            // ignore if layer already exists
          }
        }
      } else {
        try {
          map.addSource('route-main', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'LineString', coordinates },
              properties: {},
            },
          });
          map.addLayer({
            id: 'route-main',
            type: 'line',
            source: 'route-main',
            paint: {
              'line-color': '#00ff41',
              'line-width': 2,
              'line-opacity': 0.9,
            },
          });
        } catch {
          // ignore
        }
      }
    }

    // Render NFZ circles
    nfzs.forEach((nfz, nfzIdx) => {
      const srcId = `nfz-fill-${nfzIdx}`;
      const lineId = `nfz-line-${nfzIdx}`;
      const geoData = generateNfzCircleGeoJSON(nfz.latitude, nfz.longitude, nfz.radiusM);
      try {
        map.addSource(srcId, { type: 'geojson', data: geoData });
        map.addLayer({
          id: srcId,
          type: 'fill',
          source: srcId,
          paint: {
            'fill-color': nfz.id === selectedNfzId ? '#ff0000' : '#ff3333',
            'fill-opacity': nfz.id === selectedNfzId ? 0.25 : 0.15,
          },
        });
        map.addLayer({
          id: lineId,
          type: 'line',
          source: srcId,
          paint: {
            'line-color': '#ff3333',
            'line-width': 2,
            'line-opacity': 0.8,
            'line-dasharray': [4, 3],
          },
        });
      } catch {
        // ignore duplicate
      }
    });

    // Render waypoint markers
    spatialItems.forEach((item) => {
      const isSelected = item.id === selectedMissionItemId;
      const isNew = item.id === recentlyAddedRef.current;
      const index = spatialItems.indexOf(item);

      const el = document.createElement('div');
      const size = isSelected ? 24 : 20;
      el.style.cssText = `
        width:${size}px;height:${size}px;border-radius:50%;
        background-color:${isSelected ? '#00ff41' : 'rgba(0,255,65,0.55)'};
        border:${isSelected ? '2px' : '1.5px'} solid #00ff41;
        display:flex;align-items:center;justify-content:center;
        font-family:JetBrains Mono,monospace;font-size:${isSelected ? '10px' : '9px'};
        font-weight:700;color:${isSelected ? '#000' : '#fff'};
        cursor:pointer;transition:transform 150ms ease;
        box-shadow:0 1px 6px rgba(0,0,0,0.6)${isSelected ? ',0 0 8px rgba(0,255,65,0.4)' : ''};
        user-select:none;
      `;
      if (isNew) {
        el.classList.add('marker-flash');
      }
      el.textContent = String(index + 1);
      el.title = `WP${index + 1} • ${item.name}\nLat: ${item.latitude?.toFixed(7)}\nLng: ${item.longitude?.toFixed(7)}\nAlt: ${item.altitude?.toFixed(1)}m`;

      el.onmouseenter = () => {
        if (!isDraggingRef.current) el.style.transform = 'scale(1.25)';
      };
      el.onmouseleave = () => {
        if (!isDraggingRef.current) el.style.transform = 'scale(1)';
      };

      el.onclick = (event) => {
        event.stopPropagation();
        if (activeTool === 'remove-wp') {
          deleteMissionItem(item.id);
          addToast('Waypoint deleted', 'info');
          return;
        }
        selectMissionItem(item.id);
      };

      const marker = new Marker({ element: el, draggable: true })
        .setLngLat([item.longitude ?? 0, item.latitude ?? 0])
        .addTo(map);

      marker.on('dragstart', () => {
        isDraggingRef.current = true;
        el.classList.add('marker-dragging');
        el.style.transform = 'scale(1.1)';
      });

      marker.on('dragend', () => {
        isDraggingRef.current = false;
        el.classList.remove('marker-dragging');
        el.style.transform = 'scale(1)';
        const lngLat = marker.getLngLat();
        updateMissionItem(item.id, {
          latitude: round7(lngLat.lat),
          longitude: round7(lngLat.lng),
        });
        addToast('Waypoint moved', 'success');
      });

      markersRef.current.push(marker);
    });
  }, [
    activeTool,
    deleteMissionItem,
    mapReady,
    mission,
    selectedMissionItemId,
    selectMissionItem,
    updateMissionItem,
    nfzs,
    config,
    selectedNfzId,
    addToast,
  ]);

  // Home marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (homeMarkerRef.current) {
      homeMarkerRef.current.remove();
      homeMarkerRef.current = null;
    }

    const home = mission?.homePosition;
    if (!home) return;

    const el = document.createElement('div');
    el.style.cssText = `
      width:28px;height:28px;
      background-color:rgba(255,170,0,0.2);
      border:2px solid var(--color-amber);
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      display:flex;align-items:center;justify-content:center;
      cursor:default;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    `;
    el.title = `Home\nLat: ${home.latitude.toFixed(7)}\nLng: ${home.longitude.toFixed(7)}\nAlt: ${home.altitude.toFixed(1)}m`;
    const inner = document.createElement('div');
    inner.style.cssText = `
      width:10px;height:10px;
      background-color:var(--color-amber);
      border-radius:50%;
      transform:rotate(45deg);
    `;
    el.appendChild(inner);

    homeMarkerRef.current = new Marker({ element: el })
      .setLngLat([home.longitude, home.latitude])
      .addTo(map);
  }, [mapReady, mission?.homePosition]);

  const handleContextAction = useCallback(
    (action: 'add-wp' | 'set-home' | 'fly-to') => {
      if (!contextMenu || !mission) return;
      const { lat, lng } = contextMenu.lngLat;

      switch (action) {
        case 'add-wp':
          addMissionItem(PlannerAction.WAYPOINT, {
            coordinate: {
              latitude: lat,
              longitude: lng,
              altitude: mission.settings.defaultAltitude,
            },
          });
          addToast('Waypoint added', 'success');
          break;
        case 'set-home':
          setHomePosition({ latitude: lat, longitude: lng, altitude: mission.settings.defaultAltitude });
          addToast('Home position set', 'success');
          break;
        case 'fly-to':
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
          break;
      }
      setContextMenu(null);
    },
    [addMissionItem, contextMenu, mission, setHomePosition, addToast]
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler, { once: true });
    return () => window.removeEventListener('click', handler);
  }, [contextMenu]);

  const handleFitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || !mission) return;
    const spatial = mission.items.filter(
      (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
    );
    if (spatial.length === 0) return;
    const lats = spatial.map((i) => i.latitude!);
    const lngs = spatial.map((i) => i.longitude!);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    map.fitBounds(bounds, { padding: 80, duration: 500 });
  }, [mission]);

  const handleNfzConfirm = useCallback(() => {
    if (!nfzPopover) return;
    const r = parseFloat(nfzRadius);
    if (isNaN(r) || r <= 0) return;
    addNfz(nfzPopover.lat, nfzPopover.lng, r);
    addToast(`NFZ added (${r}m radius)`, 'warning');
    setNfzPopover(null);
    setNfzRadius('500');
  }, [nfzPopover, nfzRadius, addNfz, addToast]);

  const handleLocationSearch = useCallback(async () => {
    const query = searchQuery.trim();
    const map = mapRef.current;

    if (!query || !map) {
      return;
    }

    setSearchLoading(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }

      const results = (await response.json()) as LocationSearchResult[];
      const match = results[0];

      if (!match) {
        addToast('No matching location found', 'warning');
        return;
      }

      const latitude = parseFloat(match.lat);
      const longitude = parseFloat(match.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error('Invalid search result');
      }

      const bounds = match.boundingbox;
      if (bounds && bounds.length === 4) {
        const south = parseFloat(bounds[0]);
        const north = parseFloat(bounds[1]);
        const west = parseFloat(bounds[2]);
        const east = parseFloat(bounds[3]);

        if ([south, north, west, east].every(Number.isFinite) && (Math.abs(north - south) > 0.001 || Math.abs(east - west) > 0.001)) {
          map.fitBounds(
            [
              [west, south],
              [east, north],
            ],
            { padding: 80, duration: 900 }
          );
        } else {
          map.flyTo({ center: [longitude, latitude], zoom: 14, duration: 900 });
        }
      } else {
        map.flyTo({ center: [longitude, latitude], zoom: 14, duration: 900 });
      }

      setSearchQuery(match.display_name);
      addToast('Map moved to searched location', 'success');
    } catch {
      addToast('Location search failed', 'error');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery, addToast]);

  // NFZ keyboard delete
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNfzId) {
        deleteNfz(selectedNfzId);
        addToast('NFZ removed', 'info');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNfzId, deleteNfz, addToast]);

  if (!mission) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg-raised)', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        No mission loaded
      </div>
    );
  }

  const selectedItem = mission.items.find((item) => item.id === selectedMissionItemId) ?? null;

  const controlButtonStyle: React.CSSProperties = {
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,10,0.85)',
    border: '1px solid var(--color-border-mid)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-dim)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    backdropFilter: 'blur(4px)',
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({
      zoom: mapRef.current.getZoom() + (direction === 'in' ? 1 : -1),
      duration: 250,
    });
  };

  return (
    <div style={{ flex: 1, position: 'relative', backgroundColor: 'var(--color-bg-raised)', overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Zoom + style controls */}
      <div style={{ position: 'absolute', bottom: 40, left: 8, display: 'flex', flexDirection: 'column', gap: '3px', zIndex: 10 }}>
        <button style={controlButtonStyle} onClick={() => handleZoom('in')} title="Zoom in (+)"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(10,10,10,0.85)'; e.currentTarget.style.color = 'var(--color-text-dim)'; }}>
          <ZoomIn size={14} />
        </button>
        <button style={controlButtonStyle} onClick={() => handleZoom('out')} title="Zoom out (-)"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(10,10,10,0.85)'; e.currentTarget.style.color = 'var(--color-text-dim)'; }}>
          <ZoomOut size={14} />
        </button>
        <button
          style={{
            ...controlButtonStyle,
            marginTop: '2px',
            backgroundColor: mapStyle === 'satellite' ? 'var(--color-blue)' : 'rgba(10,10,10,0.85)',
            color: mapStyle === 'satellite' ? '#fff' : 'var(--color-text-dim)',
          }}
          onClick={() => setMapStyle((v) => (v === 'vector' ? 'satellite' : 'vector'))}
          title={mapStyle === 'vector' ? 'Satellite view' : 'Map view'}
        >
          {mapStyle === 'satellite' ? <MapIcon size={14} /> : <Satellite size={14} />}
        </button>
        <button
          style={{ ...controlButtonStyle, marginTop: '2px' }}
          onClick={handleFitAll}
          title="Fit all waypoints"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; e.currentTarget.style.color = 'var(--color-text)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(10,10,10,0.85)'; e.currentTarget.style.color = 'var(--color-text-dim)'; }}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Map legend */}
      <div style={{
        position: 'absolute', bottom: 8, left: 8, zIndex: 10,
        backgroundColor: 'rgba(10,10,10,0.85)', border: '1px solid var(--color-border-mid)',
        borderRadius: 'var(--radius-sm)', padding: '4px 8px', backdropFilter: 'blur(4px)',
        fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)',
        display: 'flex', flexDirection: 'column', gap: '2px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '20px', height: '2px', background: '#00ff41' }} /> Normal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '20px', height: '2px', background: '#ffaa00' }} /> High alt
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '20px', height: '2px', background: '#ff3333' }} /> Near NFZ
        </div>
      </div>

      {/* Active tool badge */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
        <div style={{
          padding: '3px 8px', backgroundColor: 'rgba(0,255,65,0.12)',
          border: '1px solid var(--color-green)', borderRadius: 'var(--radius-sm)',
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          color: 'var(--color-green)', textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {activeTool.replace(/-/g, ' ')}
        </div>
      </div>

      {/* Mission info */}
      <div style={{ position: 'absolute', top: 40, left: 8, zIndex: 10 }}>
        <div style={{
          backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid var(--color-green)',
          borderRadius: 'var(--radius-md)', padding: '6px 10px',
          backdropFilter: 'blur(6px)', minWidth: '170px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00ff41', flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>{mission.name}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>
            {mission.items.filter((item) => item.latitude !== null && item.longitude !== null).length} WPs · {mission.items.length} items
          </div>
          {selectedItem && (
            <div style={{ marginTop: '3px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-green)' }}>
              Selected: {selectedItem.name}
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 8, right: 52, zIndex: 10 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: '320px',
            padding: '6px',
            backgroundColor: 'rgba(10,10,10,0.9)',
            border: '1px solid var(--color-border-mid)',
            borderRadius: 'var(--radius-md)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <Search size={14} color="var(--color-text-dim)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                void handleLocationSearch();
              }
            }}
            placeholder="Search location or area"
            style={{
              flex: 1,
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => void handleLocationSearch()}
            disabled={searchLoading || !searchQuery.trim()}
            title="Fly to searched location"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              backgroundColor: searchLoading || !searchQuery.trim() ? 'var(--color-bg-hover)' : 'var(--color-green-bg)',
              border: `1px solid ${searchLoading || !searchQuery.trim() ? 'var(--color-border-mid)' : 'var(--color-green)'}`,
              borderRadius: 'var(--radius-sm)',
              color: searchLoading || !searchQuery.trim() ? 'var(--color-text-muted)' : 'var(--color-green)',
              cursor: searchLoading || !searchQuery.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
            }}
          >
            {searchLoading ? <LoaderCircle size={13} className="animate-spin" /> : <Navigation2 size={13} />}
          </button>
        </div>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ padding: '4px 10px 2px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', letterSpacing: '0.5px' }}>
            {contextMenu.lngLat.lat.toFixed(7)}, {contextMenu.lngLat.lng.toFixed(7)}
          </div>
          <div className="context-menu-sep" />
          <div className="context-menu-item" onClick={() => handleContextAction('add-wp')}>
            <MapPin size={13} /> Add Waypoint Here
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('set-home')}>
            <Home size={13} /> Set as Home
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('fly-to')}>
            <Navigation2 size={13} /> Fly To Here
          </div>
        </div>
      )}

      {/* NFZ radius popover */}
      {nfzPopover && (
        <div
          style={{
            position: 'fixed', left: nfzPopover.x + 8, top: nfzPopover.y - 20,
            zIndex: 9999, backgroundColor: 'var(--color-bg-raised)',
            border: '1px solid var(--color-red)', borderRadius: 'var(--radius-md)',
            padding: '10px 12px', minWidth: '180px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-red)', marginBottom: '8px', fontWeight: 700 }}>
            ADD NO-FLY ZONE
          </div>
          <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '6px' }}>
            {nfzPopover.lat.toFixed(7)}, {nfzPopover.lng.toFixed(7)}
          </div>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', display: 'block', marginBottom: '4px' }}>
            Radius (m)
          </label>
          <input
            type="number"
            value={nfzRadius}
            onChange={(e) => setNfzRadius(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleNfzConfirm(); if (e.key === 'Escape') setNfzPopover(null); }}
            autoFocus
            min="1"
            style={{
              width: '100%', padding: '3px 6px', marginBottom: '8px',
              backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
              borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
              fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={handleNfzConfirm} style={{
              flex: 1, padding: '3px', backgroundColor: 'var(--color-red-bg)',
              border: '1px solid var(--color-red)', borderRadius: 'var(--radius-sm)',
              color: 'var(--color-red)', fontFamily: 'var(--font-mono)', fontSize: '10px', cursor: 'pointer',
            }}>
              Add NFZ
            </button>
            <button onClick={() => setNfzPopover(null)} style={{
              flex: 1, padding: '3px', background: 'none',
              border: '1px solid var(--color-border-mid)', borderRadius: 'var(--radius-sm)',
              color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '10px', cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {nfzs.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 60, right: 48, zIndex: 10,
          backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid var(--color-red)',
          borderRadius: 'var(--radius-md)', padding: '6px 8px', minWidth: '140px',
          fontFamily: 'var(--font-mono)', fontSize: '10px',
        }}>
          <div style={{ color: 'var(--color-red)', fontWeight: 700, marginBottom: '4px' }}>
            NFZ ({nfzs.length})
          </div>
          {nfzs.map((nfz) => (
            <div
              key={nfz.id}
              onClick={() => selectNfz(nfz.id === selectedNfzId ? null : nfz.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                color: nfz.id === selectedNfzId ? 'var(--color-red)' : 'var(--color-text-muted)',
                cursor: 'pointer',
                padding: '2px 0',
              }}
            >
              <span>{nfz.label} ({nfz.radiusM}m)</span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  deleteNfz(nfz.id);
                  addToast('NFZ removed', 'info');
                }}
                title={`Delete ${nfz.label}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  background: 'none',
                  border: '1px solid var(--color-border-mid)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Distance tooltip on hover */}
      {mission.items.length >= 2 && (() => {
        const spatial = mission.items.filter(
          (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
        );
        if (spatial.length < 2) return null;
        let dist = 0;
        for (let i = 1; i < spatial.length; i++) {
          dist += haversineDistance(
            spatial[i - 1].latitude!, spatial[i - 1].longitude!,
            spatial[i].latitude!, spatial[i].longitude!
          );
        }
        return (
          <div style={{
            position: 'absolute', bottom: 8, right: 8, zIndex: 10,
            backgroundColor: 'rgba(10,10,10,0.85)', border: '1px solid var(--color-border-mid)',
            borderRadius: 'var(--radius-sm)', padding: '3px 8px',
            fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)',
          }}>
            {dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${Math.round(dist)} m`}
          </div>
        );
      })()}
    </div>
  );
}
