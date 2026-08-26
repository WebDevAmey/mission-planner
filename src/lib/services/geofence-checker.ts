import { haversineDistance } from '@/lib/utils';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import type { MissionItem } from '@/types/mission';
import type { GeofenceItem } from '@/lib/store/geofence-store';

export interface GeofenceViolation {
  waypointIndex: number;
  geofenceId: string;
  geofenceLabel: string;
  message: string;
}

function pointInPolygon(lat: number, lng: number, vertices: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    const intersects =
      vi.lng > lng !== vj.lng > lng &&
      lat < ((vj.lat - vi.lat) * (lng - vi.lng)) / (vj.lng - vi.lng) + vi.lat;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeofence(lat: number, lng: number, fence: GeofenceItem): boolean {
  if (fence.type === 'circle' && fence.center && fence.radiusM !== undefined) {
    return haversineDistance(lat, lng, fence.center.lat, fence.center.lng) <= fence.radiusM;
  }
  if (fence.type === 'polygon' && fence.vertices && fence.vertices.length >= 3) {
    return pointInPolygon(lat, lng, fence.vertices);
  }
  return false;
}

/** Checks every spatial mission item (waypoint + segment midpoint) against keep-out and keep-in geofences. */
export function checkGeofences(items: MissionItem[], geofences: GeofenceItem[]): GeofenceViolation[] {
  const enabled = geofences.filter((g) => g.enabled);
  if (enabled.length === 0) return [];

  const keepOut = enabled.filter((g) => g.mode === 'keep-out');
  const keepIn = enabled.filter((g) => g.mode === 'keep-in');
  const violations: GeofenceViolation[] = [];

  const spatial = items
    .map((item, index) => ({ item, index }))
    .filter(
      ({ item }) =>
        supportsCoordinates(item.action) && item.latitude !== null && item.longitude !== null
    );

  for (const { item, index } of spatial) {
    const lat = item.latitude!;
    const lng = item.longitude!;

    for (const fence of keepOut) {
      if (pointInGeofence(lat, lng, fence)) {
        violations.push({
          waypointIndex: index,
          geofenceId: fence.id,
          geofenceLabel: fence.label,
          message: `Waypoint ${index + 1} enters keep-out zone "${fence.label}"`,
        });
      }
    }

    if (keepIn.length > 0 && !keepIn.some((fence) => pointInGeofence(lat, lng, fence))) {
      violations.push({
        waypointIndex: index,
        geofenceId: keepIn[0].id,
        geofenceLabel: keepIn.map((f) => f.label).join(', '),
        message: `Waypoint ${index + 1} is outside all keep-in zones`,
      });
    }
  }

  // Segment midpoints — catches a leg that clips a zone between two otherwise-clear waypoints.
  for (let i = 1; i < spatial.length; i++) {
    const a = spatial[i - 1].item;
    const b = spatial[i].item;
    const midLat = (a.latitude! + b.latitude!) / 2;
    const midLng = (a.longitude! + b.longitude!) / 2;

    for (const fence of keepOut) {
      if (pointInGeofence(midLat, midLng, fence)) {
        violations.push({
          waypointIndex: spatial[i].index,
          geofenceId: fence.id,
          geofenceLabel: fence.label,
          message: `Leg into waypoint ${spatial[i].index + 1} clips keep-out zone "${fence.label}"`,
        });
      }
    }

    if (keepIn.length > 0 && !keepIn.some((fence) => pointInGeofence(midLat, midLng, fence))) {
      violations.push({
        waypointIndex: spatial[i].index,
        geofenceId: keepIn[0].id,
        geofenceLabel: keepIn.map((f) => f.label).join(', '),
        message: `Leg into waypoint ${spatial[i].index + 1} exits all keep-in zones`,
      });
    }
  }

  return violations;
}
