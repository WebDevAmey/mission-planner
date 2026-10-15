'use client';

import { RiAlertLine, RiArrowUpSLine, RiArrowDownSLine, RiCheckboxCircleLine, RiErrorWarningLine } from '@remixicon/react';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { useUIStore } from '@/lib/store/ui-store';
import { formatDurationShort } from '@/lib/domain/metrics';
import { formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cx('flex items-baseline gap-1.5 whitespace-nowrap', className)}>
      <span className="text-caption-1-medium text-text-tertiary">{label}</span>
      <span className="font-mono text-caption-1-semibold tabular-nums text-text-primary">{value}</span>
    </div>
  );
}

const RISK_CLASS = { LOW: 'text-text-primary', MEDIUM: 'text-amber', HIGH: 'text-red' } as const;
const RISK_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' } as const;

/** 40px status bar: the single place for mission metrics and check counts. */
export function StatusBar() {
  const analysis = useMissionAnalysis();
  const terrainOpen = useUIStore((s) => s.terrainOpen);
  const setTerrainOpen = useUIStore((s) => s.setTerrainOpen);
  const setTab = useUIStore((s) => s.setInspectorTab);

  if (!analysis) return <div className="h-10 shrink-0 border-t border-separator-border bg-background-secondary-default" />;
  const { metrics, errors, warnings, risk } = analysis;

  return (
    <footer
      aria-label="Mission summary"
      className="flex h-10 shrink-0 items-center gap-4 overflow-x-auto border-t border-separator-border bg-background-secondary-default px-4"
    >
      <Stat label="Distance" value={formatDistance(metrics.distanceM)} />
      <Stat label="Time" value={`${metrics.unbounded ? '≥ ' : ''}${formatDurationShort(metrics.timeS)}`} />
      <Stat label="Waypoints" value={String(metrics.spatialCount)} className="hidden sm:flex" />
      <Stat label="Max alt" value={`${Math.round(metrics.maxAltM)} m`} className="hidden md:flex" />
      <div className="hidden items-baseline gap-1.5 whitespace-nowrap md:flex" title={`Risk score ${Math.round(risk.total)}/100 (informational)`}>
        <span className="text-caption-1-medium text-text-tertiary">Risk</span>
        <span className={cx('text-caption-1-semibold', RISK_CLASS[risk.level])}>{RISK_LABEL[risk.level]}</span>
      </div>
      <button
        type="button"
        onClick={() => setTab('checks')}
        className="flex items-center gap-3 rounded-md px-1.5 py-1 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        aria-label={`${errors} errors, ${warnings} warnings. Open checks`}
      >
        {errors === 0 && warnings === 0 ? (
          <span className="flex items-center gap-1 text-caption-1-semibold text-text-secondary">
            <RiCheckboxCircleLine className="size-4 text-green" aria-hidden /> No issues
          </span>
        ) : (
          <>
            <span className={cx('flex items-center gap-1 text-caption-1-semibold', errors ? 'text-red' : 'text-text-tertiary')}>
              <RiErrorWarningLine className="size-4" aria-hidden /> {errors} error{errors === 1 ? '' : 's'}
            </span>
            <span className={cx('flex items-center gap-1 text-caption-1-semibold', warnings ? 'text-amber' : 'text-text-tertiary')}>
              <RiAlertLine className="size-4" aria-hidden /> {warnings} warning{warnings === 1 ? '' : 's'}
            </span>
          </>
        )}
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => setTerrainOpen(!terrainOpen)}
        aria-expanded={terrainOpen}
        aria-controls="terrain-profile"
        className="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-caption-1-semibold text-text-secondary outline-none hover:bg-background-primary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        {terrainOpen ? <RiArrowDownSLine className="size-4" aria-hidden /> : <RiArrowUpSLine className="size-4" aria-hidden />}
        Terrain
      </button>
    </footer>
  );
}
