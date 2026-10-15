import { missionFromItems } from '@/lib/domain/mission';
import { zoneIssues } from '@/lib/domain/validate';
import { fromGeofence } from '@/lib/domain/zones';
import type { MissionItem } from '@/types/mission';
import type { GeofenceItem } from '@/lib/store/geofence-store';

export interface GeofenceViolation {
  waypointIndex: number;
  geofenceId: string;
  geofenceLabel: string;
  message: string;
}

/**
 * Checks every waypoint and every leg against keep-out and keep-in geofences using real
 * segment intersection. Legacy adapter over `zoneIssues` from `@/lib/domain/validate`.
 */
export function checkGeofences(items: MissionItem[], geofences: GeofenceItem[]): GeofenceViolation[] {
  const zones = geofences.map(fromGeofence);
  const byId = new Map(geofences.map((g) => [g.id, g]));
  const indexOf = new Map(items.map((it, i) => [it.id, i]));
  return zoneIssues(missionFromItems(items), zones).map((issue) => {
    const ids = issue.itemIds;
    const target = ids[ids.length - 1] ?? ids[0];
    return {
      waypointIndex: target !== undefined ? (indexOf.get(target) ?? 0) : 0,
      geofenceId: issue.zoneId ?? '',
      geofenceLabel: byId.get(issue.zoneId ?? '')?.label ?? '',
      message: issue.message,
    };
  });
}
