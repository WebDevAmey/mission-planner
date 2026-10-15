import { useMemo } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import type { MissionZone } from '@/lib/store/editor-types';

/** Legacy geofence shape, kept for the existing checker and exporters. Backed by
 * the open mission's zones (keep-in / keep-out), which are saved to the server. */
export interface GeofenceItem {
  id: string;
  type: 'circle' | 'polygon';
  mode: 'keep-in' | 'keep-out';
  label: string;
  color: string;
  center?: { lat: number; lng: number };
  radiusM?: number;
  vertices?: { lat: number; lng: number }[];
  enabled: boolean;
}

/** Legacy localStorage key; read once by the import prompt, then deleted. */
export const LEGACY_GEOFENCE_KEY = 'mps-geofence-store';

const MODE_COLOR = { 'keep-in': 'var(--color-blue)', 'keep-out': 'var(--color-red)' } as const;

export function zonesToGeofences(zones: MissionZone[]): GeofenceItem[] {
  return zones
    .filter((z) => z.kind !== 'no_fly' || z.shape === 'polygon')
    .map((z) => {
      const mode = z.kind === 'keep_in' ? 'keep-in' : 'keep-out';
      return {
        id: z.id,
        type: z.shape,
        mode,
        label: z.label,
        color: MODE_COLOR[mode],
        center: z.centerLat !== null && z.centerLng !== null ? { lat: z.centerLat, lng: z.centerLng } : undefined,
        radiusM: z.radiusM ?? undefined,
        vertices: z.vertices?.map(([lng, lat]) => ({ lat, lng })),
        enabled: z.enabled,
      };
    });
}

export function geofenceToZone(g: Omit<GeofenceItem, 'id' | 'color'>): Omit<MissionZone, 'id'> {
  return {
    kind: g.mode === 'keep-in' ? 'keep_in' : 'keep_out',
    shape: g.type,
    label: g.label,
    enabled: g.enabled,
    centerLat: g.center?.lat ?? null,
    centerLng: g.center?.lng ?? null,
    radiusM: g.radiusM ?? null,
    vertices: g.vertices?.map((v) => [v.lng, v.lat] as [number, number]) ?? null,
  };
}

export function useGeofenceStore() {
  const zones = useMissionStore((s) => s.mission?.zones);
  const addZone = useMissionStore((s) => s.addZone);
  const updateZone = useMissionStore((s) => s.updateZone);
  const deleteZone = useMissionStore((s) => s.deleteZone);
  const selectedGeofenceId = useUIStore((s) => s.selectedZoneId);
  const selectZone = useUIStore((s) => s.selectZone);
  const geofences = useMemo(() => zonesToGeofences(zones ?? []), [zones]);

  return {
    geofences,
    selectedGeofenceId,
    deleteGeofence: (id: string) => deleteZone(id),
    toggleGeofence: (id: string) => {
      const z = zones?.find((zone) => zone.id === id);
      if (z) updateZone(id, { enabled: !z.enabled });
    },
    selectGeofence: (id: string | null) => selectZone(id),
    addGeofence: (g: Omit<GeofenceItem, 'id' | 'color'>) => addZone(geofenceToZone(g)),
  };
}
