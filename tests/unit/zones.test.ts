import { describe, expect, it } from 'vitest';
import { fromGeofence, fromNoFlyZone, toNoFlyZone, zoneInputSchema, zonesFromLegacy } from '@/lib/domain/zones';

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
