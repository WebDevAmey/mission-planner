import { describe, expect, it } from 'vitest';
import {
  convexHull,
  createProjection,
  distPointSegment,
  haversineM,
  minWidth,
  pointInPolygon,
  polygonArea,
  segmentEntersPolygonInterior,
  segmentIntersectsCircle,
  segmentIntersectsPolygon,
  segmentsIntersect,
  validateLngLatPolygon,
  type Vec,
} from '@/lib/domain/geo';

const v = (x: number, y: number): Vec => ({ x, y });
const square = [v(0, 0), v(10, 0), v(10, 10), v(0, 10)];

describe('projection', () => {
  it('round-trips and agrees with haversine within 0.1%', () => {
    const proj = createProjection([8, 47]);
    const p = proj.toLocal([8.01, 47.01]);
    const back = proj.toLngLat(p);
    expect(back[0]).toBeCloseTo(8.01, 9);
    expect(back[1]).toBeCloseTo(47.01, 9);
    const planar = Math.hypot(p.x, p.y);
    const hav = haversineM([8, 47], [8.01, 47.01]);
    expect(Math.abs(planar - hav) / hav).toBeLessThan(0.001);
  });
});

describe('planar', () => {
  it('segment-point distance', () => {
    expect(distPointSegment(v(5, 5), v(0, 0), v(10, 0))).toBeCloseTo(5);
    expect(distPointSegment(v(-3, 4), v(0, 0), v(10, 0))).toBeCloseTo(5);
  });
  it('segment-circle detects a pass-through with both ends outside', () => {
    expect(segmentIntersectsCircle(v(-100, 0), v(100, 0), v(0, 5), 10)).toBe(true);
    expect(segmentIntersectsCircle(v(-100, 0), v(100, 0), v(0, 50), 10)).toBe(false);
  });
  it('segment intersection incl. collinear touch', () => {
    expect(segmentsIntersect(v(0, 0), v(10, 10), v(0, 10), v(10, 0))).toBe(true);
    expect(segmentsIntersect(v(0, 0), v(5, 0), v(5, 0), v(9, 0))).toBe(true);
    expect(segmentsIntersect(v(0, 0), v(4, 0), v(5, 0), v(9, 0))).toBe(false);
  });
});

describe('polygon', () => {
  it('point in polygon', () => {
    expect(pointInPolygon(v(5, 5), square)).toBe(true);
    expect(pointInPolygon(v(15, 5), square)).toBe(false);
  });
  it('segment crossing polygon with both ends outside', () => {
    expect(segmentIntersectsPolygon(v(-5, 5), v(15, 5), square)).toBe(true);
    expect(segmentIntersectsPolygon(v(-5, 15), v(15, 15), square)).toBe(false);
  });
  it('interior test ignores edge-grazing', () => {
    expect(segmentEntersPolygonInterior(v(0, 0), v(10, 0), square)).toBe(false);
    expect(segmentEntersPolygonInterior(v(0, 0), v(10, 10), square)).toBe(true);
  });
  it('area, hull and min width', () => {
    expect(polygonArea(square)).toBeCloseTo(100);
    expect(convexHull([...square, v(5, 5)])).toHaveLength(4);
    const rect = [v(0, 0), v(100, 0), v(100, 20), v(0, 20)];
    const mw = minWidth(rect);
    expect(mw.width).toBeCloseTo(20);
    expect(Math.abs(Math.sin(mw.angle))).toBeCloseTo(0);
    // Rotated rectangle: min width direction follows the long side.
    const rot = rect.map((p) => v(p.x * Math.cos(0.5) - p.y * Math.sin(0.5), p.x * Math.sin(0.5) + p.y * Math.cos(0.5)));
    const mw2 = minWidth(rot);
    expect(mw2.width).toBeCloseTo(20);
    expect(Math.abs(Math.sin(mw2.angle - 0.5))).toBeLessThan(1e-6);
  });
  it('validity', () => {
    expect(validateLngLatPolygon([[8, 47], [8.01, 47], [8.01, 47.01], [8, 47]]).ok).toBe(true);
    expect(validateLngLatPolygon([[8, 47], [8.01, 47]]).reason).toBe('too_few_points');
    expect(
      validateLngLatPolygon([[8, 47], [8.01, 47.01], [8.01, 47], [8, 47.01]]).reason
    ).toBe('self_intersecting');
  });
});
