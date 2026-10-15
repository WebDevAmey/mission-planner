'use client';

import { RiAlertLine, RiCheckboxCircleLine, RiErrorWarningLine } from '@remixicon/react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import type { Issue } from '@/lib/domain/validate';
import { cx } from '@/utils/cx';

/** One issue: icon + text (never colour alone); clicking selects the affected item or zone. */
export function IssueRow({ issue }: { issue: Issue }) {
  const items = useMissionStore((s) => s.mission?.items);
  const { selectMissionItem, selectZone, focusMap, setInspectorTab } = useUIStore();
  const numbers = issue.itemIds
    .map((id) => (items ?? []).findIndex((i) => i.id === id))
    .filter((i) => i >= 0)
    .map((i) => i + 1);
  const isError = issue.severity === 'error';
  const actionable = numbers.length > 0 || !!issue.zoneId;

  const go = () => {
    const first = (items ?? []).find((i) => i.id === issue.itemIds[0]);
    if (first) {
      selectMissionItem(first.id);
      if (first.latitude !== null && first.longitude !== null) focusMap({ kind: 'point', point: [first.longitude, first.latitude] });
      setInspectorTab('item');
    } else if (issue.zoneId) {
      selectZone(issue.zoneId);
      setInspectorTab('settings');
    }
  };

  const Icon = isError ? RiErrorWarningLine : RiAlertLine;
  const content = (
    <>
      <Icon className={cx('mt-0.5 size-4 shrink-0', isError ? 'text-red' : 'text-amber')} aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-2-regular text-text-primary">
          <span className="sr-only">{isError ? 'Error: ' : 'Warning: '}</span>
          {issue.message}
        </span>
        {numbers.length > 0 && (
          <span className="text-caption-1-medium text-text-secondary">
            {numbers.length === 1 ? `Item ${numbers[0]}` : `Items ${numbers.slice(0, 6).join(', ')}${numbers.length > 6 ? '…' : ''}`}
          </span>
        )}
      </span>
    </>
  );

  return (
    <li>
      {actionable ? (
        <button
          type="button"
          onClick={go}
          className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-start outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-2.5 px-2 py-2">{content}</div>
      )}
    </li>
  );
}

/** Unified Checks (PRODUCT_SPEC W5), driven by the shared validator. */
export function ChecksTab() {
  const analysis = useMissionAnalysis();
  if (!analysis) return null;
  const errors = analysis.issues.filter((i) => i.severity === 'error');
  const warnings = analysis.issues.filter((i) => i.severity === 'warning');

  if (analysis.issues.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <RiCheckboxCircleLine className="size-8 text-green" aria-hidden />
        <p className="text-body-medium text-text-primary">All checks pass</p>
        <p className="text-body-2-regular text-text-secondary">Limits, zones, structure and endurance look good.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-2 pb-6">
      {errors.length > 0 && (
        <section aria-labelledby="checks-errors">
          <h3 id="checks-errors" className="px-2 pb-1 text-caption-1-semibold uppercase tracking-wide text-red">
            {errors.length} error{errors.length === 1 ? '' : 's'} · must fix before flight
          </h3>
          <ul>
            {errors.map((issue, i) => (
              <IssueRow key={`e${i}`} issue={issue} />
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section aria-labelledby="checks-warnings">
          <h3 id="checks-warnings" className="px-2 pb-1 text-caption-1-semibold uppercase tracking-wide text-amber">
            {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </h3>
          <ul>
            {warnings.map((issue, i) => (
              <IssueRow key={`w${i}`} issue={issue} />
            ))}
          </ul>
        </section>
      )}
      <p className="px-2 text-caption-1-regular text-text-tertiary">
        Risk score {Math.round(analysis.risk.total)}/100 is informational; errors decide whether export needs confirmation.
      </p>
    </div>
  );
}
