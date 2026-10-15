'use client';

import { useMemo, useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { useUIStore } from '@/lib/store/ui-store';
import { formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';

const W = 1000;
const H = 160;
const PAD_T = 12;
const PAD_B = 4;

/**
 * Terrain clearance profile (opens upward from the status bar). Altitudes are home
 * relative, so AGL = planned alt + home elevation − terrain (see `aglM`).
 */
export function TerrainPanel() {
  const { samples, status } = useTerrainStore();
  const minAgl = useMissionStore((s) => s.mission?.limits.minAGLClearance ?? 0);
  const setTerrainOpen = useUIStore((s) => s.setTerrainOpen);
  const selectMissionItem = useUIStore((s) => s.selectMissionItem);
  const focusMap = useUIStore((s) => s.focusMap);
  const [hover, setHover] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (!samples || samples.length < 2) return null;
    const total = samples[samples.length - 1].distanceM || 1;
    // Absolute heights: flight = terrain + AGL.
    const flight = samples.map((s) => s.terrainM + s.aglM);
    const lo = Math.min(...samples.map((s) => s.terrainM));
    const hi = Math.max(...flight, lo + 10);
    const span = hi - lo || 1;
    const x = (d: number) => (d / total) * W;
    const y = (h: number) => PAD_T + (1 - (h - lo) / span) * (H - PAD_T - PAD_B);
    const terrainPath =
      `M0,${H} ` + samples.map((s) => `L${x(s.distanceM).toFixed(1)},${y(s.terrainM).toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
    const flightPath = samples.map((s, i) => `${i ? 'L' : 'M'}${x(s.distanceM).toFixed(1)},${y(flight[i]).toFixed(1)}`).join(' ');
    const floorPath = samples
      .map((s, i) => `${i ? 'L' : 'M'}${x(s.distanceM).toFixed(1)},${y(s.terrainM + minAgl).toFixed(1)}`)
      .join(' ');
    const minIdx = samples.reduce((m, s, i) => (s.aglM < samples[m].aglM ? i : m), 0);
    const low = samples.map((s, i) => ({ s, i })).filter(({ s }) => s.aglM < minAgl);
    return { total, x, y, flight, terrainPath, flightPath, floorPath, minIdx, low };
  }, [samples, minAgl]);

  const hovered = chart && hover !== null ? samples![hover] : null;
  const minSample = chart ? samples![chart.minIdx] : null;

  return (
    <section
      id="terrain-profile"
      aria-label="Terrain clearance"
      className="flex h-52 shrink-0 flex-col border-t border-separator-border bg-background-primary-default"
    >
      <div className="flex h-10 shrink-0 items-center gap-4 px-4">
        <h2 className="text-body-2-semibold text-text-primary">Terrain clearance</h2>
        {minSample && (
          <span className={cx('font-mono text-caption-1-medium tabular-nums', minSample.aglM < minAgl ? 'text-red' : 'text-text-secondary')}>
            Lowest {Math.round(minSample.aglM)} m AGL at {formatDistance(minSample.distanceM)} · minimum {minAgl} m
          </span>
        )}
        {hovered && (
          <span className="hidden font-mono text-caption-1-regular tabular-nums text-text-secondary md:inline">
            {formatDistance(hovered.distanceM)} · ground {Math.round(hovered.terrainM)} m · {Math.round(hovered.aglM)} m AGL
          </span>
        )}
        <div className="flex-1" />
        <Button size="small" variant="ghost" iconOnly leadingIcon={RiCloseLine} aria-label="Close terrain panel" onClick={() => setTerrainOpen(false)} />
      </div>
      <div className="relative min-h-0 flex-1 px-4 pb-3">
        {!chart ? (
          <p className="flex h-full items-center justify-center text-body-2-regular text-text-secondary" role="status">
            {status === 'loading'
              ? 'Looking up terrain…'
              : status === 'error'
                ? 'Terrain data is unavailable right now. Clearance is not being checked.'
                : 'Add at least two located waypoints to see the profile.'}
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="size-full overflow-visible"
            role="img"
            aria-label={`Terrain profile over ${formatDistance(chart.total)}`}
            onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const d = ((e.clientX - r.left) / r.width) * chart.total;
              let best = 0;
              samples!.forEach((s, i) => {
                if (Math.abs(s.distanceM - d) < Math.abs(samples![best].distanceM - d)) best = i;
              });
              setHover(best);
            }}
            onClick={() => {
              if (hover === null) return;
              const s = samples![hover];
              const id = s.itemIds[s.itemIds.length - 1];
              if (id) selectMissionItem(id);
              focusMap({ kind: 'point', point: s.pos });
            }}
          >
            <path d={chart.terrainPath} className="fill-background-tertiary-default stroke-text-tertiary" vectorEffect="non-scaling-stroke" strokeWidth={1} />
            <path d={chart.floorPath} className="fill-none stroke-amber" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeWidth={1} />
            <path d={chart.flightPath} className="fill-none stroke-cyan" vectorEffect="non-scaling-stroke" strokeWidth={2} />
            {chart.low.map(({ s, i }) => (
              <circle key={i} cx={chart.x(s.distanceM)} cy={chart.y(chart.flight[i])} r={3} className="fill-red" vectorEffect="non-scaling-stroke" />
            ))}
            {hover !== null && (
              <line
                x1={chart.x(samples![hover].distanceM)}
                x2={chart.x(samples![hover].distanceM)}
                y1={0}
                y2={H}
                className="stroke-text-secondary"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>
        )}
      </div>
    </section>
  );
}
