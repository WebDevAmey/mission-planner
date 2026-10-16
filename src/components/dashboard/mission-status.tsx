import { formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';
import type { MissionSummary } from './types';

type Tone = 'ok' | 'warn' | 'danger' | 'muted';

const DOT: Record<Tone, string> = {
  ok: 'bg-(color:--fd-ok)',
  warn: 'bg-(color:--fd-warn)',
  danger: 'bg-(color:--fd-danger)',
  muted: 'bg-(color:--fd-ink-3)',
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export function missionStatus(m: MissionSummary): { tone: Tone; label: string } {
  if (m.errorCount && m.errorCount > 0) return { tone: 'danger', label: plural(m.errorCount, 'error') };
  if (m.warningCount && m.warningCount > 0) return { tone: 'warn', label: plural(m.warningCount, 'warning') };
  if (m.status === 'ready') return { tone: 'ok', label: 'Ready' };
  if (m.status === 'archived') return { tone: 'muted', label: 'Archived' };
  if (m.errorCount === 0 && m.waypointCount > 0) return { tone: 'ok', label: 'Checks pass' };
  return { tone: 'muted', label: 'Draft' };
}

/** Status dot plus a text label; the colour is never the only cue. */
export function StatusLabel({ mission, className }: { mission: MissionSummary; className?: string }) {
  const s = missionStatus(mission);
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-caption-1-medium text-text-secondary', className)}>
      <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', DOT[s.tone])} />
      <span className="tabular-nums">{s.label}</span>
    </span>
  );
}

/** Distance with its unit, or an en dash. */
export const distanceText = (m: MissionSummary) => (m.distanceM != null ? formatDistance(m.distanceM) : '–');

/** Estimated flight time as minutes (or h + min) with units. */
export function durationText(m: MissionSummary): string {
  if (m.durationS == null) return '–';
  const min = Math.round(m.durationS / 60);
  if (min < 1) return m.durationS > 0 ? '<1 min' : '0 min';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** Exact clock time for tooltips next to relative times. */
export const exactTime = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
