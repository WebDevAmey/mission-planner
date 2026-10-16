'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RiMore2Fill } from '@remixicon/react';
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { SkeletonBlock } from '@/components/common/skeleton-loader';
import { cx } from '@/utils/cx';
import { MissionThumbnail } from './mission-thumbnail';
import { StatusLabel, distanceText, durationText, exactTime } from './mission-status';
import { relativeTime, type MissionSummary } from './types';

export type CardAction = 'rename' | 'duplicate' | 'export' | 'delete';

/** The per-mission overflow menu, shared by grid cards and table rows. */
export function MissionActionsMenu({
  mission,
  onAction,
  className,
}: {
  mission: MissionSummary;
  onAction: (a: CardAction, m: MissionSummary) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const act = (a: CardAction) => () => {
    setOpen(false);
    onAction(a, mission);
  };
  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger
        aria-label={`More actions for ${mission.name}`}
        className={cx(
          'flex size-8 shrink-0 items-center justify-center rounded-fd-control text-foreground-icon-secondary transition-colors duration-150',
          'hover:bg-background-secondary-default hover:text-foreground-icon-primary',
          className
        )}
      >
        <RiMore2Fill className="size-[18px]" aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label="Mission actions" placement="bottom end" className="w-[200px]">
        <DropdownItem onSelect={act('rename')}>Rename…</DropdownItem>
        <DropdownItem onSelect={act('duplicate')}>Duplicate</DropdownItem>
        <DropdownItem onSelect={act('export')}>Export…</DropdownItem>
        <DropdownDivider />
        <DropdownItem onSelect={act('delete')} className="text-fd-danger">
          Delete…
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  );
}

/** "3.20 km" → number in ink, unit in tertiary. */
function ValueUnit({ text }: { text: string }) {
  const i = text.lastIndexOf(' ');
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)} <span className="text-text-tertiary">{text.slice(i + 1)}</span>
    </>
  );
}

export function MissionCard({ mission, onAction }: { mission: MissionSummary; onAction: (a: CardAction, m: MissionSummary) => void }) {
  const href = `/missions/${mission.id}`;

  return (
    <article
      className={cx(
        'group relative flex flex-col overflow-hidden rounded-fd-control border border-separator-border bg-background-primary-default',
        'transition-colors duration-150 hover:border-fd-line-strong has-[a:focus-visible]:border-fd-line-strong'
      )}
    >
      <MissionThumbnail id={mission.id} version={mission.version} hasGeometry={!!mission.bbox} className="border-b border-separator-border" />
      <div className="flex flex-col gap-2 px-4 pt-3 pb-3.5">
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-body-medium text-text-primary">
            <Link
              href={href}
              className={cx(
                'outline-none after:absolute after:inset-0 after:rounded-fd-control after:content-[""]',
                'focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-border-focus-ring'
              )}
            >
              {mission.name}
            </Link>
          </h3>
          <MissionActionsMenu mission={mission} onAction={onAction} className="relative z-10 -me-2" />
        </div>
        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-body-2-regular tabular-nums text-text-primary">
          <div className="flex gap-1">
            <dt className="sr-only">Waypoints</dt>
            <dd>
              {mission.waypointCount} <span className="text-text-tertiary">{mission.waypointCount === 1 ? 'waypoint' : 'waypoints'}</span>
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="sr-only">Distance</dt>
            <dd>
              <ValueUnit text={distanceText(mission)} />
            </dd>
          </div>
          <div className="flex gap-1">
            <dt className="sr-only">Estimated time</dt>
            <dd>
              <ValueUnit text={durationText(mission)} />
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-separator-border px-4 py-2.5">
        <StatusLabel mission={mission} />
        <time dateTime={mission.updatedAt} title={exactTime(mission.updatedAt)} className="truncate text-caption-1-regular tabular-nums text-text-tertiary">
          Edited {relativeTime(mission.updatedAt)}
        </time>
      </div>
    </article>
  );
}

export function MissionCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-fd-control border border-separator-border bg-background-primary-default" aria-hidden>
      <SkeletonBlock className="aspect-[32/15] rounded-none" />
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
        <SkeletonBlock className="h-4 w-2/3" />
        <SkeletonBlock className="h-3.5 w-1/2" />
      </div>
      <div className="flex items-center justify-between border-t border-separator-border px-4 py-3">
        <SkeletonBlock className="h-3 w-16" />
        <SkeletonBlock className="h-3 w-20" />
      </div>
    </div>
  );
}
