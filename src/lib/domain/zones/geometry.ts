import {
  type LocalProjection,
  type LngLat,
  type Vec,
  openRing,
  pointInPolygon,
  segmentIntersectsCircle,
  segmentIntersectsPolygon,
  dist,
} from '@/lib/domain/geo';
import type { Zone } from './types';

/** A zone in the local metric frame. */
export type LocalZone =
  | { zone: Zone; shape: 'circle'; c: Vec; r: number }
  | { zone: Zone; shape: 'polygon'; poly: Vec[] };

/** Usable geometry check (enabled with a complete shape). */
export function hasGeometry(z: Zone): boolean {
  if (z.shape === 'circle') return z.centerLat != null && z.centerLng != null && (z.radiusM ?? 0) > 0;
  return (z.vertices?.length ?? 0) >= 3;
}

export function zonePoints(z: Zone): LngLat[] {
  if (z.shape === 'circle') return [[z.centerLng!, z.centerLat!]];
  return openRing(z.vertices ?? []);
}

export function toLocalZone(z: Zone, proj: LocalProjection): LocalZone {
  if (z.shape === 'circle') {
    return { zone: z, shape: 'circle', c: proj.toLocal([z.centerLng!, z.centerLat!]), r: z.radiusM! };
  }
  return { zone: z, shape: 'polygon', poly: openRing(z.vertices ?? []).map(proj.toLocal) };
}

export function pointInLocalZone(p: Vec, lz: LocalZone): boolean {
  return lz.shape === 'circle' ? dist(p, lz.c) <= lz.r : pointInPolygon(p, lz.poly);
}

export function segmentHitsLocalZone(a: Vec, b: Vec, lz: LocalZone): boolean {
  return lz.shape === 'circle'
    ? segmentIntersectsCircle(a, b, lz.c, lz.r)
    : segmentIntersectsPolygon(a, b, lz.poly);
}

/** True when the segment leaves the zone (any part outside). Assumes keep-in semantics. */
export function segmentLeavesLocalZone(a: Vec, b: Vec, lz: LocalZone, samples = 16): boolean {
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    if (!pointInLocalZone({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, lz)) return true;
  }
  if (lz.shape === 'polygon') {
    // A straight segment between two inside points can still exit a concave polygon.
    for (let i = 0, j = lz.poly.length - 1; i < lz.poly.length; j = i++) {
      const p = lz.poly[i];
      const q = lz.poly[j];
      // proper crossing means it goes out and back in
      const d1 = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
      const d2 = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
      const d3 = (q.x - p.x) * (a.y - p.y) - (q.y - p.y) * (a.x - p.x);
      const d4 = (q.x - p.x) * (b.y - p.y) - (q.y - p.y) * (b.x - p.x);
      if (d1 * d2 < 0 && d3 * d4 < 0) return true;
    }
  }
  return false;
}

/** Whether an altitude interval [lo, hi] overlaps the zone's vertical band (unbounded when unset). */
export function altitudeOverlaps(z: Zone, lo: number, hi: number): boolean {
  const zmin = z.minAltM ?? -Infinity;
  const zmax = z.maxAltM ?? Infinity;
  return Math.max(lo, hi) >= zmin && Math.min(lo, hi) <= zmax;
}

/** Polygon approximating a circle, buffered outward so the polygon encloses the circle. */
export function circleToPolygon(c: Vec, r: number, margin = 0, segments = 16): Vec[] {
  // Circumscribe: the inscribed radius of a regular n-gon is R cos(pi/n).
  const R = (r + margin) / Math.cos(Math.PI / segments);
  const out: Vec[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (2 * Math.PI * i) / segments;
    out.push({ x: c.x + R * Math.cos(a), y: c.y + R * Math.sin(a) });
  }
  return out;
}
