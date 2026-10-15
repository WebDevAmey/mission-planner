import { useMemo } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import type { EditorMission, MissionLimits, MissionZone } from '@/lib/store/editor-types';

/**
 * Legacy constraint types, kept so existing services keep compiling. The data now
 * lives on the open mission (zones + limits, saved to the server) instead of a
 * browser-wide localStorage store, so nothing leaks between missions or accounts.
 */
export interface NoFlyZone {
  id: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  label: string;
}

export interface ConstraintConfig {
  maxDistanceM: number;
  maxAltM: number;
  minAltM: number;
  maxSpeedMs: number;
  minAGLClearance: number;
  defaultSpeedMs: number;
}

export interface ConstraintViolation {
  seq?: number;
  field: string;
  message: string;
}

/** Legacy localStorage key; read once by the import prompt, then deleted. */
export const LEGACY_CONSTRAINTS_KEY = 'mps-constraints-store';

export function zonesToNfzs(zones: MissionZone[]): NoFlyZone[] {
  return zones
    .filter((z) => z.enabled && z.kind === 'no_fly' && z.shape === 'circle' && z.centerLat !== null && z.centerLng !== null && z.radiusM)
    .map((z) => ({ id: z.id, latitude: z.centerLat!, longitude: z.centerLng!, radiusM: z.radiusM!, label: z.label }));
}

export function missionToConfig(mission: Pick<EditorMission, 'limits' | 'settings'> | null): ConstraintConfig {
  const limits: MissionLimits = mission?.limits ?? {
    maxDistanceM: 10000,
    maxAltM: 400,
    minAltM: 10,
    maxSpeedMs: 20,
    minAGLClearance: 30,
  };
  return { ...limits, defaultSpeedMs: mission?.settings.defaultSpeed ?? 10 };
}

/** Same surface as the old zustand store, backed by the open mission. */
export function useConstraintsStore() {
  const mission = useMissionStore((s) => s.mission);
  const addZone = useMissionStore((s) => s.addZone);
  const updateZone = useMissionStore((s) => s.updateZone);
  const deleteZone = useMissionStore((s) => s.deleteZone);
  const updateLimits = useMissionStore((s) => s.updateLimits);
  const updateSettings = useMissionStore((s) => s.updateSettings);
  const selectedNfzId = useUIStore((s) => s.selectedZoneId);
  const selectZone = useUIStore((s) => s.selectZone);

  const zones = mission?.zones;
  const nfzs = useMemo(() => zonesToNfzs(zones ?? []), [zones]);
  const config = useMemo(() => missionToConfig(mission), [mission]);

  return {
    config,
    nfzs,
    selectedNfzId,
    updateConfig: (updates: Partial<ConstraintConfig>) => {
      const { defaultSpeedMs, ...limits } = updates;
      if (Object.keys(limits).length > 0) updateLimits(limits);
      if (defaultSpeedMs !== undefined) updateSettings({ defaultSpeed: defaultSpeedMs });
    },
    addNfz: (lat: number, lng: number, radiusM: number, label?: string) =>
      addZone({
        kind: 'no_fly',
        shape: 'circle',
        label: label ?? `No-fly ${nfzs.length + 1}`,
        enabled: true,
        centerLat: lat,
        centerLng: lng,
        radiusM,
        vertices: null,
      }),
    updateNfz: (id: string, updates: Partial<Omit<NoFlyZone, 'id'>>) =>
      updateZone(id, {
        ...(updates.latitude !== undefined && { centerLat: updates.latitude }),
        ...(updates.longitude !== undefined && { centerLng: updates.longitude }),
        ...(updates.radiusM !== undefined && { radiusM: updates.radiusM }),
        ...(updates.label !== undefined && { label: updates.label }),
      }),
    deleteNfz: (id: string) => deleteZone(id),
    selectNfz: (id: string | null) => selectZone(id),
  };
}
