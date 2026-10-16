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

/** Axis-aligned bounding box in the local metric frame. */
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * A zone in the local metric frame. `box` bounds the zone, padded by BOX_PAD_M so the
 * cheap box tests below can only skip work whose exact answer is already "no".
 */
export type LocalZone =
  | { zone: Zone; shape: 'circle'; c: Vec; r: number; box: Box }
  | { zone: Zone; shape: 'polygon'; poly: Vec[]; box: Box };

/** Far larger than the 1e-9 tolerances in the exact predicates, far below anything that matters. */
const BOX_PAD_M = 1e-6;

/** Bounding box of `points`, grown by `grow` metres plus a tiny pad. */
export function boxOf(points: Vec[], grow = 0): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const g = grow + BOX_PAD_M;
  return { minX: minX - g, minY: minY - g, maxX: maxX + g, maxY: maxY + g };
}

const pointOutsideBox = (p: Vec, b: Box) => p.x < b.minX || p.x > b.maxX || p.y < b.minY || p.y > b.maxY;

/** True when segment `ac` cannot touch anything inside box `b`. */
export const segmentOutsideBox = (a: Vec, c: Vec, b: Box) =>
  Math.max(a.x, c.x) < b.minX || Math.min(a.x, c.x) > b.maxX || Math.max(a.y, c.y) < b.minY || Math.min(a.y, c.y) > b.maxY;

/** Euclidean gap between the bounding box of segment `ab` and `box` (0 when they overlap). A lower bound on any distance from the segment to what the box contains. */
export function segmentBoxGap(a: Vec, b: Vec, box: Box): number {
  const dx = Math.max(0, box.minX - Math.max(a.x, b.x), Math.min(a.x, b.x) - box.maxX);
  const dy = Math.max(0, box.minY - Math.max(a.y, b.y), Math.min(a.y, b.y) - box.maxY);
  return Math.sqrt(dx * dx + dy * dy);
}

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
    const c = proj.toLocal([z.centerLng!, z.centerLat!]);
    const r = z.radiusM!;
    return { zone: z, shape: 'circle', c, r, box: boxOf([c], r) };
  }
  const poly = openRing(z.vertices ?? []).map(proj.toLocal);
  return { zone: z, shape: 'polygon', poly, box: boxOf(poly) };
}

export function pointInLocalZone(p: Vec, lz: LocalZone): boolean {
  if (pointOutsideBox(p, lz.box)) return false;
  return lz.shape === 'circle' ? dist(p, lz.c) <= lz.r : pointInPolygon(p, lz.poly);
}

export function segmentHitsLocalZone(a: Vec, b: Vec, lz: LocalZone): boolean {
  if (segmentOutsideBox(a, b, lz.box)) return false;
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
