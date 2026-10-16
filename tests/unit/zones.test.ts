import { describe, expect, it } from 'vitest';
import { createProjection, dist, distPointSegment, distSegmentSegment, pointInPolygon, segmentIntersectsCircle, segmentIntersectsPolygon, type Vec } from '@/lib/domain/geo';
import {
  fromGeofence,
  fromNoFlyZone,
  pointInLocalZone,
  segmentBoxGap,
  segmentHitsLocalZone,
  toLocalZone,
  toNoFlyZone,
  zoneInputSchema,
  zonesFromLegacy,
  type Zone,
} from '@/lib/domain/zones';

describe('zones', () => {
  it('adapts legacy no-fly circles and geofences', () => {
    const nfz = { id: 'n1', latitude: 47, longitude: 8, radiusM: 200, label: 'Airport' };
    const z = fromNoFlyZone(nfz);
    expect(z).toMatchObject({ kind: 'no_fly', shape: 'circle', centerLat: 47, centerLng: 8, radiusM: 200 });
    expect(toNoFlyZone(z)).toEqual(nfz);
    const g = fromGeofence({
      id: 'g1', type: 'polygon', mode: 'keep-in', label: 'Field', color: 'x', enabled: false,
      vertices: [{ lat: 1, lng: 2 }, { lat: 1, lng: 3 }, { lat: 2, lng: 3 }],
    });
    expect(g).toMatchObject({ kind: 'keep_in', shape: 'polygon', enabled: false, vertices: [[2, 1], [3, 1], [3, 2]] });
    expect(zonesFromLegacy([nfz], [])).toHaveLength(1);
  });

  it('schema validates shapes', () => {
    expect(zoneInputSchema.safeParse({ kind: 'no_fly', shape: 'circle', centerLat: 1, centerLng: 2, radiusM: 10 }).success).toBe(true);
    expect(zoneInputSchema.safeParse({ kind: 'no_fly', shape: 'circle', centerLat: 1 }).success).toBe(false);
    expect(
      zoneInputSchema.safeParse({ kind: 'keep_out', shape: 'polygon', vertices: [[8, 47], [8.01, 47.01], [8.01, 47], [8, 47.01]] }).success
    ).toBe(false);
  });
});

describe('zone bounding boxes', () => {
  function rng(seed: number) {
    return () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
  }
  const proj = createProjection([8, 47]);
  const base = { label: '', enabled: true, minAltM: null, maxAltM: null } as const;
  const circle: Zone = { ...base, id: 'c', kind: 'no_fly', shape: 'circle', centerLat: 47, centerLng: 8, radiusM: 150, vertices: null };
  const ring: [number, number][] = [[-200, -100], [250, -120], [80, 40], [300, 220], [-150, 180]].map(([x, y]) => proj.toLngLat({ x, y }));
  const polygon: Zone = { ...base, id: 'p', kind: 'keep_out', shape: 'polygon', centerLat: null, centerLng: null, radiusM: null, vertices: ring };

  it('box pre-checks never change point and segment answers (property)', () => {
    const r = rng(3);
    const pt = (): Vec => ({ x: r() * 1200 - 600, y: r() * 1200 - 600 });
    for (const z of [circle, polygon]) {
      const lz = toLocalZone(z, proj);
      for (let i = 0; i < 4000; i++) {
        const a = pt();
        const b = i % 3 === 0 ? a : pt();
        const exactPoint = lz.shape === 'circle' ? dist(a, lz.c) <= lz.r : pointInPolygon(a, lz.poly);
        const exactSeg = lz.shape === 'circle' ? segmentIntersectsCircle(a, b, lz.c, lz.r) : segmentIntersectsPolygon(a, b, lz.poly);
        expect(pointInLocalZone(a, lz)).toBe(exactPoint);
        expect(segmentHitsLocalZone(a, b, lz)).toBe(exactSeg);
      }
    }
  });

  it('segmentBoxGap is a lower bound on the clearance to the zone', () => {
    const r = rng(9);
    const lz = toLocalZone(polygon, proj);
    const lc = toLocalZone(circle, proj);
    for (let i = 0; i < 2000; i++) {
      const a = { x: r() * 3000 - 1500, y: r() * 3000 - 1500 };
      const b = { x: a.x + r() * 400 - 200, y: a.y + r() * 400 - 200 };
      if (lz.shape === 'polygon') {
        let d = Infinity;
        for (let k = 0, j = lz.poly.length - 1; k < lz.poly.length; j = k++) d = Math.min(d, distSegmentSegment(a, b, lz.poly[j], lz.poly[k]));
        expect(segmentBoxGap(a, b, lz.box)).toBeLessThanOrEqual(d + 1e-9);
      }
      if (lc.shape === 'circle') {
        expect(segmentBoxGap(a, b, lc.box)).toBeLessThanOrEqual(Math.max(0, distPointSegment(lc.c, a, b) - lc.r) + 1e-9);
      }
    }
  });
});
