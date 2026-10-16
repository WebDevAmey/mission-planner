'use client';

import { useMemo, useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { useUIStore } from '@/lib/store/ui-store';
import { formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';
import { ICON_BUTTON } from '@/components/editor/editor-styles';
import { Button as AriaButton } from 'react-aria-components';

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
    // Terrain under low-clearance stretches, redrawn in warn.
    const lowRuns: string[] = [];
    let run: string[] = [];
    samples.forEach((s, i) => {
      if (s.aglM < minAgl) run.push(`${run.length ? 'L' : 'M'}${x(s.distanceM).toFixed(1)},${y(s.terrainM).toFixed(1)}`);
      if ((s.aglM >= minAgl || i === samples.length - 1) && run.length) {
        lowRuns.push(run.length === 1 ? `${run[0]} l0.1,0` : run.join(' '));
        run = [];
      }
    });
    // Waypoint ticks: where one leg hands over to the next.
    const ticks = samples
      .filter((s, i) => i === 0 || s.itemIds.join() !== samples[i - 1].itemIds.join())
      .map((s) => x(s.distanceM));
    ticks.push(W);
    return { total, x, y, flight, terrainPath, flightPath, floorPath, minIdx, low, lowRuns, ticks };
  }, [samples, minAgl]);

  const hovered = chart && hover !== null ? samples![hover] : null;
  const minSample = chart ? samples![chart.minIdx] : null;

  return (
    <section
      id="terrain-profile"
      aria-label="Terrain clearance"
      className="flex h-52 shrink-0 flex-col border-t border-separator-border bg-background-primary-default"
    >
      <div className="flex h-10 shrink-0 items-center gap-4 pl-4 pr-2">
        <h2 className="text-[13px] font-medium text-text-primary">Terrain clearance</h2>
        {minSample && (
          <span className={cx('flex items-center gap-1.5 text-[12px] tabular-nums', minSample.aglM < minAgl ? 'text-fd-warn' : 'text-text-secondary')}>
            {minSample.aglM < minAgl && <span aria-hidden className="size-1.5 rounded-full bg-fd-warn" />}
            Lowest {Math.round(minSample.aglM)} m AGL at {formatDistance(minSample.distanceM)} · minimum {minAgl} m
          </span>
        )}
        {hovered && (
          <span className="hidden text-[12px] tabular-nums text-text-tertiary md:inline">
            {formatDistance(hovered.distanceM)} · ground {Math.round(hovered.terrainM)} m · {Math.round(hovered.aglM)} m AGL
          </span>
        )}
        <div className="flex-1" />
        <AriaButton aria-label="Close terrain panel" onPress={() => setTerrainOpen(false)} className={ICON_BUTTON}>
          <RiCloseLine className="size-4" aria-hidden />
        </AriaButton>
      </div>
      <div className="relative min-h-0 flex-1 px-4 pb-3">
        {!chart ? (
          <p className="flex h-full items-center justify-center text-[13px] text-text-secondary" role="status">
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
            <path d={chart.terrainPath} className="fill-fd-surface-2 stroke-fd-ink-3" vectorEffect="non-scaling-stroke" strokeWidth={1} />
            {chart.lowRuns.map((d, i) => (
              <path key={i} d={d} className="fill-none stroke-fd-warn" vectorEffect="non-scaling-stroke" strokeWidth={2.5} strokeLinecap="round" />
            ))}
            <path d={chart.floorPath} className="fill-none stroke-fd-ink-3" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" strokeWidth={1} />
            <path d={chart.flightPath} className="fill-none stroke-fd-accent" vectorEffect="non-scaling-stroke" strokeWidth={2} />
            {chart.ticks.map((tx, i) => (
              <line key={`t${i}`} x1={tx} x2={tx} y1={H - 6} y2={H} className="stroke-fd-ink-2" vectorEffect="non-scaling-stroke" strokeWidth={1} />
            ))}
            {hover !== null && (
              <line
                x1={chart.x(samples![hover].distanceM)}
                x2={chart.x(samples![hover].distanceM)}
                y1={0}
                y2={H}
                className="stroke-fd-ink-2"
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
