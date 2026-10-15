import { haversineDistance } from '@/lib/utils';

/** [longitude, latitude] in degrees (GeoJSON order). */
export type LngLat = [number, number];
/** Local east/north offset in metres. */
export interface Vec {
  x: number;
  y: number;
}

const R = 6371000;
const RAD = Math.PI / 180;

export interface LocalProjection {
  origin: LngLat;
  toLocal: (p: LngLat) => Vec;
  toLngLat: (v: Vec) => LngLat;
}

/**
 * Equirectangular (local ENU) projection around `origin`. Accurate to <0.1% for
 * areas up to ~20 km, which is the scale of a mission.
 */
export function createProjection(origin: LngLat): LocalProjection {
  const [lng0, lat0] = origin;
  const k = Math.cos(lat0 * RAD);
  return {
    origin,
    toLocal: ([lng, lat]) => ({ x: (lng - lng0) * RAD * R * k, y: (lat - lat0) * RAD * R }),
    toLngLat: ({ x, y }) => [lng0 + x / (R * k * RAD), lat0 + y / (R * RAD)],
  };
}

/** Arithmetic centroid of a point set (fine as a projection origin). */
export function centroid(points: LngLat[]): LngLat {
  if (points.length === 0) return [0, 0];
  let sx = 0;
  let sy = 0;
  for (const [x, y] of points) {
    sx += x;
    sy += y;
  }
  return [sx / points.length, sy / points.length];
}

/** Projection centred on the centroid of all given points. */
export function projectionFor(points: LngLat[]): LocalProjection {
  return createProjection(centroid(points));
}

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversineM(a: LngLat, b: LngLat): number {
  return haversineDistance(a[1], a[0], b[1], b[0]);
}

/** Point `t` (0..1) along a straight lng/lat segment (fine at mission scale). */
export function lerpLngLat(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
