'use client';

import { RiAlertLine, RiErrorWarningLine } from '@remixicon/react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import type { Issue } from '@/lib/domain/validate';
import { cx } from '@/utils/cx';
import { FOCUS_RING_INSET, TONE_DOT, TONE_TEXT } from '../editor-styles';

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
      <Icon className={cx('mt-0.5 size-4 shrink-0', isError ? TONE_TEXT.danger : TONE_TEXT.warn)} aria-hidden />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] leading-5 text-text-primary">
          <span className="sr-only">{isError ? 'Error: ' : 'Warning: '}</span>
          {issue.message}
        </span>
        {numbers.length > 0 && (
          <span className="text-[12px] tabular-nums text-text-tertiary">
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
          className={cx('flex w-full items-start gap-2.5 px-4 py-2 text-start transition-colors duration-[120ms] hover:bg-background-primary-hover', FOCUS_RING_INSET)}
        >
          {content}
        </button>
      ) : (
        <div className="flex items-start gap-2.5 px-4 py-2">{content}</div>
      )}
    </li>
  );
}

function GroupHeading({ id, tone, children }: { id: string; tone: 'danger' | 'warn'; children: React.ReactNode }) {
  return (
    <h3 id={id} className="flex h-8 items-center gap-2 border-y border-separator-border bg-background-secondary-default px-4 text-[13px] font-medium text-text-primary">
      <span aria-hidden className={cx('size-2 rounded-full', TONE_DOT[tone])} />
      {children}
    </h3>
  );
}

/** Pre-flight checks (PRODUCT_SPEC W5), driven by the shared validator. */
export function ChecksTab() {
  const analysis = useMissionAnalysis();
  if (!analysis) return null;
  const errors = analysis.issues.filter((i) => i.severity === 'error');
  const warnings = analysis.issues.filter((i) => i.severity === 'warning');

  return (
    <div className="flex flex-col pb-6">
      <div className="flex items-baseline justify-between gap-2 px-4 pb-2">
        <h2 className="text-[14px] font-medium text-text-primary">Pre-flight checks</h2>
        <span className="text-[12px] tabular-nums text-text-tertiary">Risk {Math.round(analysis.risk.total)}/100</span>
      </div>
      {analysis.issues.length === 0 ? (
        <div className="flex flex-col gap-1 px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] text-text-primary">
            <span aria-hidden className={cx('size-2 rounded-full', TONE_DOT.ok)} />
            All checks pass
          </p>
          <p className="pl-4 text-[13px] text-text-secondary">Altitude limits, terrain clearance, zones, structure and endurance.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {errors.length > 0 && (
            <section aria-labelledby="checks-errors">
              <GroupHeading id="checks-errors" tone="danger">
                <span className="tabular-nums">{errors.length}</span> error{errors.length === 1 ? '' : 's'}
                <span className="font-normal text-text-tertiary">· fix before flight</span>
              </GroupHeading>
              <ul>
                {errors.map((issue, i) => (
                  <IssueRow key={`e${i}`} issue={issue} />
                ))}
              </ul>
            </section>
          )}
          {warnings.length > 0 && (
            <section aria-labelledby="checks-warnings">
              <GroupHeading id="checks-warnings" tone="warn">
                <span className="tabular-nums">{warnings.length}</span> warning{warnings.length === 1 ? '' : 's'}
              </GroupHeading>
              <ul>
                {warnings.map((issue, i) => (
                  <IssueRow key={`w${i}`} issue={issue} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <p className="px-4 pt-4 text-[12px] text-text-tertiary">
        The risk score is informational; errors decide whether export asks for confirmation.
      </p>
    </div>
  );
}
