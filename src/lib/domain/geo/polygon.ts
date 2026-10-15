import type { LngLat, Vec } from './projection';
import { cross, dist, distPointSegment, segmentsCrossProperly, segmentsIntersect, sub } from './planar';

/** Ray-casting point-in-polygon (polygon is an open ring of local points). */
export function pointInPolygon(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** True when segment `ab` touches/crosses any edge, or lies inside the polygon. */
export function segmentIntersectsPolygon(a: Vec, b: Vec, poly: Vec[]): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsIntersect(a, b, poly[j], poly[i])) return true;
  }
  return false;
}

/**
 * True when segment `ab` passes through the polygon's interior. Grazing a vertex or
 * running along an edge does not count (used by path planning, where via-points sit
 * on buffered polygon vertices).
 */
export function segmentEntersPolygonInterior(a: Vec, b: Vec, poly: Vec[]): boolean {
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsCrossProperly(a, b, poly[j], poly[i])) return true;
  }
  // No proper crossing: test a few interior sample points that are not on the boundary.
  for (const t of [0.5, 0.25, 0.75, 0.01, 0.99]) {
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (pointInPolygon(p, poly) && distanceToBoundary(p, poly) > 1e-6) return true;
  }
  return false;
}

export function distanceToBoundary(p: Vec, poly: Vec[]): number {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    m = Math.min(m, distPointSegment(p, poly[j], poly[i]));
  }
  return m;
}

/** Signed shoelace area (positive = counter-clockwise). */
export function signedArea(poly: Vec[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
  }
  return s / 2;
}

export const polygonArea = (poly: Vec[]): number => Math.abs(signedArea(poly));

/** Andrew's monotone chain; returns a counter-clockwise hull without repeated end point. */
export function convexHull(points: Vec[]): Vec[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Vec[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(sub(lower[lower.length - 1], lower[lower.length - 2]), sub(p, lower[lower.length - 2])) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Vec[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(sub(upper[upper.length - 1], upper[upper.length - 2]), sub(p, upper[upper.length - 2])) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

/**
 * Minimum width of a point set via rotating calipers over the convex hull. Returns the
 * width and the direction (radians from +x/east, counter-clockwise) of the hull edge that
 * achieves it. Sweeping lines parallel to that edge minimises the number of passes.
 */
export function minWidth(points: Vec[]): { width: number; angle: number } {
  const hull = convexHull(points);
  if (hull.length < 3) {
    const a = hull[0] ?? { x: 0, y: 0 };
    const b = hull[1] ?? a;
    return { width: 0, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  let best = { width: Infinity, angle: 0 };
  const n = hull.length;
  let k = 1;
  for (let i = 0; i < n; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % n];
    const e = sub(b, a);
    const el = Math.hypot(e.x, e.y);
    if (el === 0) continue;
    const h = (p: Vec) => Math.abs(cross(e, sub(p, a))) / el;
    // Advance the antipodal pointer while the distance keeps growing.
    while (h(hull[(k + 1) % n]) > h(hull[k]) + 1e-12) k = (k + 1) % n;
    const w = h(hull[k]);
    if (w < best.width) best = { width: w, angle: Math.atan2(e.y, e.x) };
  }
  return best;
}

export interface PolygonValidity {
  ok: boolean;
  reason?: 'too_few_points' | 'self_intersecting' | 'zero_area' | 'invalid_coordinates';
}

/** Drop a closing vertex equal to the first one. */
export function openRing<T extends LngLat | Vec>(ring: T[]): T[] {
  if (ring.length < 2) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  const same = Array.isArray(a)
    ? (a as LngLat)[0] === (b as LngLat)[0] && (a as LngLat)[1] === (b as LngLat)[1]
    : (a as Vec).x === (b as Vec).x && (a as Vec).y === (b as Vec).y;
  return same ? ring.slice(0, -1) : ring;
}

/** Validates a ring of local points: >=3 distinct, non-zero area, no self-intersection. */
export function validatePolygon(ringIn: Vec[]): PolygonValidity {
  const ring = openRing(ringIn);
  if (ring.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    return { ok: false, reason: 'invalid_coordinates' };
  }
  const distinct = ring.filter((p, i) => ring.findIndex((q) => dist(p, q) < 1e-9) === i);
  if (distinct.length < 3) return { ok: false, reason: 'too_few_points' };
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;
      if (segmentsIntersect(ring[i], ring[(i + 1) % n], ring[j], ring[(j + 1) % n])) {
        return { ok: false, reason: 'self_intersecting' };
      }
    }
  }
  if (polygonArea(ring) < 1e-6) return { ok: false, reason: 'zero_area' };
  return { ok: true };
}
