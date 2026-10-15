/**
 * Denormalised mission summary written on every save so the dashboard never
 * loads waypoints. Server-side and dependency-free; when the shared domain
 * validator lands this delegates the counts to it.
 */

export interface SummaryWaypoint {
  action: string;
  latitude: number | null;
  longitude: number | null;
  altitude: number | null;
  speed: number | null;
  param1: number;
}

export interface SummarySettings {
  defaultSpeed: number;
  cruiseSpeed?: number | null;
  ratedEnduranceS?: number | null;
  maxDistanceM?: number | null;
  maxAltM?: number | null;
  minAltM?: number | null;
  maxSpeedMs?: number | null;
}

export interface SummaryZone {
  kind: string;
  shape: string;
  enabled: boolean;
  centerLat: number | null;
  centerLng: number | null;
  radiusM: number | null;
  vertices: unknown;
}

export interface MissionSummaryColumns {
  distanceM: number;
  durationS: number;
  waypointCount: number;
  errorCount: number;
  warningCount: number;
  bboxMinLat: number | null;
  bboxMinLng: number | null;
  bboxMaxLat: number | null;
  bboxMaxLng: number | null;
}

const R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inZone(lat: number, lng: number, z: SummaryZone): boolean {
  if (z.shape === 'circle') {
    if (z.centerLat == null || z.centerLng == null || z.radiusM == null) return false;
    return haversineM(lat, lng, z.centerLat, z.centerLng) <= z.radiusM;
  }
  const ring = Array.isArray(z.vertices) ? (z.vertices as [number, number][]) : [];
  return ring.length >= 3 && pointInRing(lng, lat, ring);
}

const LOITER_TIME_ACTIONS = new Set(['loiter', 'wait']);
const SPATIAL_LEG_SAMPLES = 8;

export function computeMissionSummary(
  items: SummaryWaypoint[],
  settings: SummarySettings,
  home: { latitude: number; longitude: number } | null,
  zones: SummaryZone[] = []
): MissionSummaryColumns {
  const cruise = settings.cruiseSpeed ?? settings.defaultSpeed ?? 12;
  const spatial = items.filter(
    (i): i is SummaryWaypoint & { latitude: number; longitude: number } =>
      i.latitude !== null && i.longitude !== null
  );

  let errors = 0;
  let warnings = 0;

  // Legs: home -> first spatial item -> ... ; RTL flies back to home.
  const path: { lat: number; lng: number; speed: number }[] = [];
  if (home) path.push({ lat: home.latitude, lng: home.longitude, speed: cruise });
  for (const item of items) {
    if (item.latitude !== null && item.longitude !== null) {
      path.push({ lat: item.latitude, lng: item.longitude, speed: item.speed ?? cruise });
    } else if (item.action === 'rtl' && home) {
      path.push({ lat: home.latitude, lng: home.longitude, speed: cruise });
    }
  }

  let distanceM = 0;
  let durationS = 0;
  const exclusion = zones.filter((z) => z.enabled && (z.kind === 'no_fly' || z.kind === 'keep_out'));
  const inclusion = zones.filter((z) => z.enabled && z.kind === 'keep_in');
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const d = haversineM(a.lat, a.lng, b.lat, b.lng);
    distanceM += d;
    durationS += d / Math.max(0.1, b.speed);
    if (exclusion.length || inclusion.length) {
      for (let s = 0; s <= SPATIAL_LEG_SAMPLES; s++) {
        const t = s / SPATIAL_LEG_SAMPLES;
        const lat = a.lat + (b.lat - a.lat) * t;
        const lng = a.lng + (b.lng - a.lng) * t;
        if (exclusion.some((z) => inZone(lat, lng, z)) || inclusion.some((z) => !inZone(lat, lng, z))) {
          errors++;
          break;
        }
      }
    }
  }

  for (const item of items) {
    if (LOITER_TIME_ACTIONS.has(item.action)) durationS += Math.max(0, item.param1 || 0);
    if (item.altitude !== null && item.action !== 'land' && item.action !== 'rtl') {
      if (settings.maxAltM != null && item.altitude > settings.maxAltM) errors++;
      else if (settings.minAltM != null && item.altitude < settings.minAltM && item.action !== 'takeoff') warnings++;
    }
    if (item.speed !== null && settings.maxSpeedMs != null && item.speed > settings.maxSpeedMs) errors++;
    if (home && item.latitude !== null && item.longitude !== null && settings.maxDistanceM != null) {
      if (haversineM(home.latitude, home.longitude, item.latitude, item.longitude) > settings.maxDistanceM) errors++;
    }
  }

  if (settings.ratedEnduranceS) {
    if (durationS > settings.ratedEnduranceS) errors++;
    else if (durationS > settings.ratedEnduranceS * 0.8) warnings++;
  }

  const lats = spatial.map((i) => i.latitude);
  const lngs = spatial.map((i) => i.longitude);
  if (home) {
    lats.push(home.latitude);
    lngs.push(home.longitude);
  }

  return {
    distanceM: Math.round(distanceM * 10) / 10,
    durationS: Math.round(durationS),
    waypointCount: items.length,
    errorCount: errors,
    warningCount: warnings,
    bboxMinLat: lats.length ? Math.min(...lats) : null,
    bboxMinLng: lngs.length ? Math.min(...lngs) : null,
    bboxMaxLat: lats.length ? Math.max(...lats) : null,
    bboxMaxLng: lngs.length ? Math.max(...lngs) : null,
  };
}
