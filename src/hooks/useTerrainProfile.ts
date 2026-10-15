'use client';

import { useEffect, useMemo } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { buildClearanceSamples, computeClearanceProfile, homeElevationPoint } from '@/lib/domain/metrics';

const MAX_SAMPLES = 400;
const CHUNK = 100;

type Pt = { lat: number; lng: number };

/** Elevations (m AMSL) via the server proxy (/api/geo/elevation, cached). */
async function lookupElevations(points: Pt[], signal: AbortSignal): Promise<number[] | null> {
  const out: number[] = [];
  try {
    for (let i = 0; i < points.length; i += CHUNK) {
      const res = await fetch('/api/geo/elevation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: points.slice(i, i + CHUNK) }),
        signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { elevations?: (number | null)[] };
      const els = data.elevations ?? [];
      for (let j = 0; j < Math.min(CHUNK, points.length - i); j++) out.push(els[j] ?? NaN);
    }
  } catch (err) {
    if (signal.aborted) throw err;
    return null;
  }
  // Fill gaps by carrying the nearest known value so a single miss doesn't read as sea level.
  let last = out.find((v) => Number.isFinite(v));
  if (last === undefined) return null;
  return out.map((v) => (Number.isFinite(v) ? (last = v) : last!));
}

/**
 * Keeps `useTerrainStore` in sync with the open mission's route: samples every leg,
 * looks up terrain, and stores the home-relative AGL profile that the Checks tab and
 * the terrain panel read. Debounced; stale results are dropped on route change.
 */
export function useTerrainProfile() {
  const mission = useMissionStore((s) => s.mission);
  const setTerrain = useTerrainStore((s) => s.set);

  const plan = useMemo(() => {
    if (!mission) return null;
    let samples = buildClearanceSamples(mission);
    if (samples.length < 2) return null;
    if (samples.length > MAX_SAMPLES) {
      const step = samples.length / MAX_SAMPLES;
      const thinned = Array.from({ length: MAX_SAMPLES }, (_, i) => samples[Math.floor(i * step)]);
      thinned[thinned.length - 1] = samples[samples.length - 1];
      samples = thinned;
    }
    const home = homeElevationPoint(mission);
    const knownHomeElev = mission.settings.homeElevationM;
    const key = JSON.stringify([
      samples.map((s) => [s.pos[0].toFixed(5), s.pos[1].toFixed(5), Math.round(s.relAltM)]),
      home,
      knownHomeElev ?? null,
    ]);
    return { key, samples, home, knownHomeElev };
  }, [mission]);

  useEffect(() => {
    const current = useTerrainStore.getState();
    if (!plan) {
      if (current.samples || current.missionKey) setTerrain({ missionKey: null, samples: null, status: 'idle' });
      return;
    }
    if (current.missionKey === plan.key && current.status === 'ready') return;

    // Drop a profile that belongs to an older route before it can mislead the checks.
    setTerrain({ missionKey: plan.key, samples: null, status: 'loading' });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      const pts: Pt[] = plan.samples.map((s) => ({ lng: s.pos[0], lat: s.pos[1] }));
      const needHome = plan.knownHomeElev == null && plan.home;
      if (needHome) pts.push({ lng: plan.home![0], lat: plan.home![1] });
      try {
        const els = await lookupElevations(pts, ctrl.signal);
        if (ctrl.signal.aborted) return;
        if (!els) {
          setTerrain({ status: 'error' });
          return;
        }
        const homeElev = plan.knownHomeElev ?? (needHome ? els[els.length - 1] : els[0]);
        const profile = computeClearanceProfile(plan.samples, els.slice(0, plan.samples.length), homeElev);
        setTerrain({ missionKey: plan.key, samples: profile, status: 'ready' });
      } catch {
        /* aborted */
      }
    }, 1200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [plan, setTerrain]);
}
