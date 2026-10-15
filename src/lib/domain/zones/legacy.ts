import type { NoFlyZone } from '@/lib/store/constraints-store';
import type { GeofenceItem } from '@/lib/store/geofence-store';
import type { Zone } from './types';

/** Legacy constraints-store circle -> no_fly circle zone. */
export function fromNoFlyZone(nfz: NoFlyZone): Zone {
  return {
    id: nfz.id,
    kind: 'no_fly',
    shape: 'circle',
    label: nfz.label,
    enabled: true,
    centerLat: nfz.latitude,
    centerLng: nfz.longitude,
    radiusM: nfz.radiusM,
    vertices: null,
  };
}

/** Legacy geofence-store item -> keep_in/keep_out zone. */
export function fromGeofence(g: GeofenceItem): Zone {
  return {
    id: g.id,
    kind: g.mode === 'keep-in' ? 'keep_in' : 'keep_out',
    shape: g.type,
    label: g.label,
    enabled: g.enabled,
    centerLat: g.center?.lat ?? null,
    centerLng: g.center?.lng ?? null,
    radiusM: g.radiusM ?? null,
    vertices: g.vertices ? g.vertices.map((v) => [v.lng, v.lat] as [number, number]) : null,
  };
}

/** Merge both legacy browser stores into one zone list. */
export function zonesFromLegacy(nfzs: NoFlyZone[] = [], geofences: GeofenceItem[] = []): Zone[] {
  return [...nfzs.map(fromNoFlyZone), ...geofences.map(fromGeofence)];
}

/** Zone -> legacy NoFlyZone (circles only), for UI still on the old store shape. */
export function toNoFlyZone(zone: Zone): NoFlyZone | null {
  if (zone.shape !== 'circle' || zone.centerLat == null || zone.centerLng == null || !zone.radiusM) {
    return null;
  }
  return {
    id: zone.id,
    latitude: zone.centerLat,
    longitude: zone.centerLng,
    radiusM: zone.radiusM,
    label: zone.label,
  };
}
