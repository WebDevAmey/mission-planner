'use client';

import { RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { useUIStore } from '@/lib/store/ui-store';
import { formatDurationShort } from '@/lib/domain/metrics';
import { formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';
import { FOCUS_RING_INSET } from './editor-styles';

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cx('flex h-full items-center gap-1.5 whitespace-nowrap border-r border-separator-border px-3 first:pl-0 md:first:pl-1', className)}>
      <span className="text-[12px] text-text-tertiary">{label}</span>
      <span className="text-[13px] tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

/** 32px status bar (DESIGN_SPEC §5.4): distance, est. time, waypoints, max altitude.
 * Check counts live in the header chip; terrain opens upward from here. */
export function StatusBar() {
  const analysis = useMissionAnalysis();
  const terrainOpen = useUIStore((s) => s.terrainOpen);
  const setTerrainOpen = useUIStore((s) => s.setTerrainOpen);

  if (!analysis) return <div className="h-8 shrink-0 border-t border-separator-border bg-background-primary-default" />;
  const { metrics } = analysis;

  return (
    <footer
      aria-label="Mission summary"
      className="flex h-8 shrink-0 items-center overflow-x-auto border-t border-separator-border bg-background-primary-default px-3"
    >
      <Stat label="Distance" value={formatDistance(metrics.distanceM)} />
      <Stat label="Est. time" value={`${metrics.unbounded ? '≥ ' : ''}${formatDurationShort(metrics.timeS)}`} />
      <Stat label="Waypoints" value={String(metrics.spatialCount)} className="max-[359px]:hidden" />
      <Stat label="Max alt" value={`${Math.round(metrics.maxAltM)} m`} className="hidden sm:flex" />
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setTerrainOpen(!terrainOpen)}
        aria-expanded={terrainOpen}
        aria-controls="terrain-profile"
        aria-label="Terrain clearance profile"
        className={cx(
          'flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[13px] text-text-secondary transition-colors duration-[120ms] hover:bg-background-primary-hover hover:text-text-primary',
          FOCUS_RING_INSET
        )}
      >
        {terrainOpen ? <RiArrowDownSLine className="size-4" aria-hidden /> : <RiArrowUpSLine className="size-4" aria-hidden />}
        <span className="max-sm:hidden">Terrain</span>
      </button>
    </footer>
  );
}
