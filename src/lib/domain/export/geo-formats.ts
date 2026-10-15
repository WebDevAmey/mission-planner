import { COMMAND_NAMES, getMissionCommandDefinition } from '@/lib/mavlink/commands';
import { round1, round7 } from '@/lib/utils';
import { openRing, type LngLat } from '@/lib/domain/geo';
import { hasGeometry, ZONE_KIND_LABELS, type Zone } from '@/lib/domain/zones';
import { homeOf, spatialPoints } from '@/lib/domain/mission';
import type { MissionPlan } from '@/types/mission';

/** Circle approximated as a closed [lng, lat] ring (for formats without circles). */
export function circleRing(lat: number, lng: number, radiusM: number, segments = 48): LngLat[] {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring: LngLat[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (2 * Math.PI * (i % segments)) / segments;
    ring.push([round7(lng + dLng * Math.cos(a)), round7(lat + dLat * Math.sin(a))]);
  }
  return ring;
}

const zoneRing = (z: Zone): LngLat[] => {
  if (z.shape === 'circle') return circleRing(z.centerLat!, z.centerLng!, z.radiusM!);
  const open = openRing(z.vertices ?? []).map(([a, b]) => [round7(a), round7(b)] as LngLat);
  return [...open, open[0]];
};

const activeZones = (zones?: Zone[]) => (zones ?? []).filter((z) => z.enabled && hasGeometry(z));

/** GeoJSON FeatureCollection: route LineString, waypoint Points, zones as Polygons. */
export function buildGeoJsonObject(mission: MissionPlan, zones?: Zone[]) {
  const pts = spatialPoints(mission.items);
  const home = homeOf(mission);
  const features: object[] = [];
  if (pts.length > 1) {
    features.push({
      type: 'Feature',
      properties: { kind: 'route', name: mission.name },
      geometry: { type: 'LineString', coordinates: pts.map((p) => [round7(p.pos[0]), round7(p.pos[1]), round1(p.alt)]) },
    });
  }
  if (home && mission.homePosition) {
    features.push({
      type: 'Feature',
      properties: { kind: 'home' },
      geometry: { type: 'Point', coordinates: [round7(home[0]), round7(home[1])] },
    });
  }
  for (const p of pts) {
    features.push({
      type: 'Feature',
      id: p.item.id,
      properties: {
        kind: 'waypoint',
        seq: p.index + 1,
        command: COMMAND_NAMES[p.item.command] ?? p.item.command,
        action: p.item.action,
        alt: round1(p.alt),
        speed: p.item.speed ?? null,
      },
      geometry: { type: 'Point', coordinates: [round7(p.pos[0]), round7(p.pos[1]), round1(p.alt)] },
    });
  }
  for (const z of activeZones(zones)) {
    features.push({
      type: 'Feature',
      id: z.id,
      properties: { kind: 'zone', zoneKind: z.kind, shape: z.shape, label: z.label, radiusM: z.radiusM ?? null, minAltM: z.minAltM ?? null, maxAltM: z.maxAltM ?? null },
      geometry: { type: 'Polygon', coordinates: [zoneRing(z)] },
    });
  }
  return { type: 'FeatureCollection', name: mission.name, features };
}

export const buildGeoJson = (mission: MissionPlan, zones?: Zone[]): string =>
  JSON.stringify(buildGeoJsonObject(mission, zones), null, 2);

const xml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** KML: route LineString (relativeToGround), a Placemark per waypoint, zones as Polygons. */
export function buildKml(mission: MissionPlan, zones?: Zone[]): string {
  const pts = spatialPoints(mission.items);
  const coord = (p: LngLat, alt = 0) => `${round7(p[0])},${round7(p[1])},${round1(alt)}`;
  const out: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document>',
    `<name>${xml(mission.name)}</name>`,
    '<Style id="route"><LineStyle><color>ff00c8ff</color><width>3</width></LineStyle></Style>',
    '<Style id="zone-exclusion"><LineStyle><color>ff3333ff</color><width>2</width></LineStyle><PolyStyle><color>403333ff</color></PolyStyle></Style>',
    '<Style id="zone-inclusion"><LineStyle><color>ffd27d2d</color><width>2</width></LineStyle><PolyStyle><color>20d27d2d</color></PolyStyle></Style>',
  ];
  if (pts.length > 1) {
    out.push(
      '<Placemark><name>Route</name><styleUrl>#route</styleUrl><LineString><altitudeMode>relativeToGround</altitudeMode>',
      `<coordinates>${pts.map((p) => coord(p.pos, p.alt)).join(' ')}</coordinates>`,
      '</LineString></Placemark>'
    );
  }
  out.push('<Folder><name>Waypoints</name>');
  for (const p of pts) {
    const label = getMissionCommandDefinition(p.item.action).label;
    out.push(
      `<Placemark><name>${p.index + 1} ${xml(label)}</name><Point><altitudeMode>relativeToGround</altitudeMode><coordinates>${coord(p.pos, p.alt)}</coordinates></Point></Placemark>`
    );
  }
  out.push('</Folder>');
  const zs = activeZones(zones);
  if (zs.length > 0) {
    out.push('<Folder><name>Zones</name>');
    for (const z of zs) {
      const style = z.kind === 'keep_in' ? 'zone-inclusion' : 'zone-exclusion';
      out.push(
        `<Placemark><name>${xml(`${ZONE_KIND_LABELS[z.kind]}: ${z.label}`)}</name><styleUrl>#${style}</styleUrl><Polygon><outerBoundaryIs><LinearRing><coordinates>${zoneRing(z).map((p) => coord(p)).join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`
      );
    }
    out.push('</Folder>');
  }
  out.push('</Document>', '</kml>');
  return out.join('\n') + '\n';
}
