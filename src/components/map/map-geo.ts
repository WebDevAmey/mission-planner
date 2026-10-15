import type { StyleSpecification } from 'maplibre-gl';
import { haversineM, type LngLat } from '@/lib/domain/geo';
import { missionLegs, legItemIds } from '@/lib/domain/mission';
import { supportsCoordinates, PlannerAction } from '@/lib/mavlink/commands';
import type { Issue } from '@/lib/domain/validate';
import type { EditorMission, MissionZone } from '@/lib/store/editor-types';

export const VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
const GLYPHS_URL = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const LABEL_FONT = ['Noto Sans Bold'];

/** Esri imagery as a raster style; glyphs keep waypoint labels working. */
export function satelliteStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS_URL,
    sources: {
      satellite: {
        type: 'raster',
        tiles: [SATELLITE_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution:
          'Imagery © <a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a>, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
  };
}

export const emptyFC = <G extends Point | LineString | Polygon>(): FeatureCollection<G> => ({
  type: 'FeatureCollection',
  features: [],
});

/** Geodesic-ish circle ring (small-radius equirectangular approximation). */
export function circleRing(center: LngLat, radiusM: number, steps = 64): LngLat[] {
  const [lng, lat] = center;
  const R = 6371000;
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    const dLat = (radiusM / R) * (180 / Math.PI) * Math.cos(a);
    const dLng = (radiusM / (R * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI) * Math.sin(a);
    ring.push([lng + dLng, lat + dLat]);
  }
  return ring;
}

export function zoneRing(z: Pick<MissionZone, 'shape' | 'centerLat' | 'centerLng' | 'radiusM' | 'vertices'>): LngLat[] | null {
  if (z.shape === 'circle') {
    if (z.centerLat == null || z.centerLng == null || !z.radiusM) return null;
    return circleRing([z.centerLng, z.centerLat], z.radiusM);
  }
  if (!z.vertices || z.vertices.length < 3) return null;
  const ring = [...z.vertices];
  const [f, l] = [ring[0], ring[ring.length - 1]];
  if (f[0] !== l[0] || f[1] !== l[1]) ring.push(f);
  return ring;
}

export type WaypointKind = 'takeoff' | 'land' | 'loiter' | 'roi' | 'waypoint';

function kindOf(action: PlannerAction): WaypointKind {
  switch (action) {
    case PlannerAction.TAKEOFF:
      return 'takeoff';
    case PlannerAction.LAND:
      return 'land';
    case PlannerAction.LOITER:
    case PlannerAction.LOITER_TURNS:
    case PlannerAction.LOITER_UNLIM:
      return 'loiter';
    case PlannerAction.SET_ROI:
      return 'roi';
    default:
      return 'waypoint';
  }
}

/** Highest severity per item id. */
export function severityByItem(issues: Issue[]): Map<string, 'error' | 'warning'> {
  const out = new Map<string, 'error' | 'warning'>();
  for (const issue of issues) {
    for (const id of issue.itemIds) {
      if (out.get(id) !== 'error') out.set(id, issue.severity);
    }
  }
  return out;
}

export function waypointFeatures(mission: EditorMission, issues: Issue[]): FeatureCollection<Point> {
  const sev = severityByItem(issues);
  const features: Feature<Point>[] = [];
  mission.items.forEach((item, index) => {
    if (!supportsCoordinates(item.action) || item.latitude === null || item.longitude === null) return;
    features.push({
      type: 'Feature',
      id: item.id,
      geometry: { type: 'Point', coordinates: [item.longitude, item.latitude] },
      properties: { id: item.id, label: String(index + 1), kind: kindOf(item.action), severity: sev.get(item.id) ?? '' },
    });
  });
  return { type: 'FeatureCollection', features };
}

export function routeFeatures(mission: EditorMission, issues: Issue[]): FeatureCollection<LineString> {
  const sev = severityByItem(issues);
  return {
    type: 'FeatureCollection',
    features: missionLegs(mission).map((leg, i) => {
      const ids = legItemIds(leg);
      const s = ids.map((id) => sev.get(id)).includes('error') ? 'error' : '';
      return {
        type: 'Feature',
        id: i,
        geometry: { type: 'LineString', coordinates: [leg.a, leg.b] },
        properties: { home: leg.from === null || leg.to === null ? 1 : 0, severity: s },
      };
    }),
  };
}

export function zoneFeatures(zones: MissionZone[]): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];
  for (const z of zones) {
    const ring = zoneRing(z);
    if (!ring) continue;
    features.push({
      type: 'Feature',
      id: z.id,
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { id: z.id, kind: z.kind, enabled: z.enabled ? 1 : 0, label: z.label },
    });
  }
  return { type: 'FeatureCollection', features };
}

export function pathLengthM(points: LngLat[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineM(points[i - 1], points[i]);
  return d;
}

export function formatDistance(m: number): string {
  if (!Number.isFinite(m)) return '–';
  return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km` : `${Math.round(m)} m`;
}

/** Bounds of every located thing in the mission (route, home, zones). */
export function missionBounds(mission: EditorMission): [[number, number], [number, number]] | null {
  const pts: LngLat[] = [];
  for (const i of mission.items) if (i.latitude !== null && i.longitude !== null && !(i.latitude === 0 && i.longitude === 0)) pts.push([i.longitude, i.latitude]);
  if (mission.homePosition) pts.push([mission.homePosition.longitude, mission.homePosition.latitude]);
  for (const z of mission.zones) {
    const ring = zoneRing(z);
    if (ring) pts.push(...ring);
  }
  if (pts.length === 0) return null;
  const lngs = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}

type FeatureCollection<G extends GeoJSON.Geometry | null = GeoJSON.Geometry> = GeoJSON.FeatureCollection<G>;
type Feature<G extends GeoJSON.Geometry | null = GeoJSON.Geometry> = GeoJSON.Feature<G>;
type Point = GeoJSON.Point;
type LineString = GeoJSON.LineString;
type Polygon = GeoJSON.Polygon;
