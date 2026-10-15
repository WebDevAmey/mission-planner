'use client';

import { useMissionStore } from '@/lib/store/mission-store';
import { useAgentStore } from '@/lib/store/agent-store';
import type { MissionPlan } from '@/types/mission';
import type { MissionZone } from '@/lib/store/editor-types';

/** Prefix shared by every browser-side key this app has ever written. */
export const LOCAL_KEY_PREFIX = 'mps-';

export const LEGACY_KEYS = {
  library: 'mps-mission-library',
  constraints: 'mps-constraints-store',
  geofences: 'mps-geofence-store',
} as const;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Remove every `mps-*` key and reset in-memory stores. Called on every sign-out
 * so nothing from one account is visible to the next person on this browser. */
export function clearLocalMissionData(): void {
  const ls = storage();
  if (ls) {
    const keys: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith(LOCAL_KEY_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => ls.removeItem(k));
  }
  useMissionStore.setState({ mission: null, past: [], future: [], lastChangeLabel: null });
  useAgentStore.setState({ history: [], events: [], result: null, status: 'idle' });
}

/** The one sign-out path for the whole app: revoke the session, wipe local data,
 * leave. Use this everywhere instead of calling /api/auth/logout directly. */
export async function signOut(redirectTo = '/'): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {
    // Still clear local data and leave; the session cookie expires server-side.
  }
  clearLocalMissionData();
  window.location.href = redirectTo;
}

function readPersisted<T>(key: string): T | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: T };
    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

interface LegacyNfz {
  id: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  label?: string;
}

interface LegacyGeofence {
  id: string;
  type: 'circle' | 'polygon';
  mode: 'keep-in' | 'keep-out';
  label?: string;
  center?: { lat: number; lng: number };
  radiusM?: number;
  vertices?: { lat: number; lng: number }[];
  enabled?: boolean;
}

export interface LegacyLocalData {
  missions: MissionPlan[];
  zones: Omit<MissionZone, 'id'>[];
}

/** Read the pre-server localStorage stores (mission library, no-fly zones,
 * geofences). Returns null when there is nothing worth importing. */
export function readLegacyLocalData(): LegacyLocalData | null {
  const library = readPersisted<{ missions?: Record<string, MissionPlan> }>(LEGACY_KEYS.library);
  const constraints = readPersisted<{ nfzs?: LegacyNfz[] }>(LEGACY_KEYS.constraints);
  const geofences = readPersisted<{ geofences?: LegacyGeofence[] }>(LEGACY_KEYS.geofences);

  const missions = Object.values(library?.missions ?? {}).filter(
    (m): m is MissionPlan => !!m && typeof m.id === 'string' && Array.isArray(m.items)
  );

  const zones: Omit<MissionZone, 'id'>[] = [
    ...(constraints?.nfzs ?? [])
      .filter((n) => Number.isFinite(n.latitude) && Number.isFinite(n.longitude) && n.radiusM > 0)
      .map((n) => ({
        kind: 'no_fly' as const,
        shape: 'circle' as const,
        label: n.label ?? 'No-fly zone',
        enabled: true,
        centerLat: n.latitude,
        centerLng: n.longitude,
        radiusM: n.radiusM,
        vertices: null,
      })),
    ...(geofences?.geofences ?? []).map((g) => ({
      kind: g.mode === 'keep-in' ? ('keep_in' as const) : ('keep_out' as const),
      shape: g.type,
      label: g.label ?? 'Zone',
      enabled: g.enabled ?? true,
      centerLat: g.center?.lat ?? null,
      centerLng: g.center?.lng ?? null,
      radiusM: g.radiusM ?? null,
      vertices: g.vertices?.map((v) => [v.lng, v.lat] as [number, number]) ?? null,
    })),
  ];

  if (missions.length === 0 && zones.length === 0) return null;
  return { missions, zones };
}

export function discardLegacyLocalData(): void {
  const ls = storage();
  if (!ls) return;
  Object.values(LEGACY_KEYS).forEach((k) => ls.removeItem(k));
}
