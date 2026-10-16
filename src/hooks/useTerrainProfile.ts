'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { buildClearanceSamples, computeClearanceProfile, homeElevationPoint } from '@/lib/domain/metrics';

const MAX_SAMPLES = 400;
const CHUNK = 100;
const DEBOUNCE_MS = 1200;

type Pt = { lat: number; lng: number };

/** Elevations (m AMSL) via the server proxy (/api/geo/elevation, cached). Chunks are fetched in parallel. */
export async function lookupElevations(points: Pt[], signal: AbortSignal): Promise<number[] | null> {
  const out: number[] = [];
  try {
    const starts = Array.from({ length: Math.ceil(points.length / CHUNK) }, (_, k) => k * CHUNK);
    const chunks = await Promise.all(
      starts.map(async (i) => {
        const res = await fetch('/api/geo/elevation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ points: points.slice(i, i + CHUNK) }),
          signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { elevations?: (number | null)[] };
        return data.elevations ?? [];
      })
    );
    for (const [k, els] of chunks.entries()) {
      if (!els) return null;
      const i = starts[k];
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
 * the terrain panel read. Debounced; a route change aborts the pending lookup, while
 * edits that leave the sampled route unchanged (name, settings, zones) keep it running.
 */
export function useTerrainProfile() {
  const mission = useMissionStore((s) => s.mission);
  const setTerrain = useTerrainStore((s) => s.set);
  /** The lookup currently debouncing or in flight, by route key. */
  const pending = useRef<{ key: string; cancel: () => void } | null>(null);

  // Abort whatever is pending when the editor unmounts.
  useEffect(
    () => () => {
      pending.current?.cancel();
      pending.current = null;
    },
    []
  );

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
      pending.current?.cancel();
      pending.current = null;
      if (current.samples || current.missionKey) setTerrain({ missionKey: null, samples: null, status: 'idle' });
      return;
    }
    // Same sampled route as the lookup already pending: let it finish.
    if (pending.current?.key === plan.key) return;
    if (current.missionKey === plan.key && current.status === 'ready') return;

    pending.current?.cancel();
    // Drop a profile that belongs to an older route before it can mislead the checks.
    setTerrain({ missionKey: plan.key, samples: null, status: 'loading' });
    const ctrl = new AbortController();
    const settle = () => {
      if (pending.current?.key === plan.key) pending.current = null;
    };
    const timer = setTimeout(async () => {
      const pts: Pt[] = plan.samples.map((s) => ({ lng: s.pos[0], lat: s.pos[1] }));
      const needHome = plan.knownHomeElev == null && plan.home;
      if (needHome) pts.push({ lng: plan.home![0], lat: plan.home![1] });
      try {
        const els = await lookupElevations(pts, ctrl.signal);
        if (ctrl.signal.aborted) return;
        settle();
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
    }, DEBOUNCE_MS);
    pending.current = {
      key: plan.key,
      cancel: () => {
        clearTimeout(timer);
        ctrl.abort();
      },
    };
  }, [plan, setTerrain]);
}
