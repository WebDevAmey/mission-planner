'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RiMore2Fill } from '@remixicon/react';
import { ButtonLink } from '@/components/base/buttons/button';
import { Chip } from '@/components/base/badges/chip';
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { formatDurationShort } from '@/lib/domain/metrics';
import { formatDistance } from '@/components/map/map-geo';
import { MissionThumbnail } from './mission-thumbnail';
import { relativeTime, type MissionSummary } from './types';

export type CardAction = 'rename' | 'duplicate' | 'export' | 'delete';

function StatusChip({ m }: { m: MissionSummary }) {
  if (m.errorCount && m.errorCount > 0)
    return (
      <Chip variant="caption" color="rose">
        {m.errorCount} error{m.errorCount === 1 ? '' : 's'}
      </Chip>
    );
  if (m.warningCount && m.warningCount > 0)
    return (
      <Chip variant="caption" color="yellow">
        {m.warningCount} warning{m.warningCount === 1 ? '' : 's'}
      </Chip>
    );
  if (m.status === 'ready')
    return (
      <Chip variant="caption" color="lime">
        Ready
      </Chip>
    );
  if (m.status === 'archived')
    return (
      <Chip variant="caption" color="gray">
        Archived
      </Chip>
    );
  return (
    <Chip variant="caption" color="neutral">
      {m.errorCount === 0 && m.waypointCount > 0 ? 'Checks pass' : 'Draft'}
    </Chip>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-caption-1-regular text-text-tertiary">{label}</dt>
      <dd className="truncate font-mono text-body-2-medium tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

export function MissionCard({ mission, onAction }: { mission: MissionSummary; onAction: (a: CardAction, m: MissionSummary) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const href = `/missions/${mission.id}`;
  const act = (a: CardAction) => () => {
    setMenuOpen(false);
    onAction(a, mission);
  };

  return (
    <article className="group flex flex-col gap-4 rounded-2lg border border-separator-border bg-background-primary-default p-4 transition-shadow hover:shadow-md">
      <Link href={href} aria-label={`Open ${mission.name}`} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <MissionThumbnail id={mission.id} version={mission.version} hasGeometry={!!mission.bbox} />
      </Link>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate text-body-semibold text-text-primary">
            <Link href={href} className="outline-none hover:underline focus-visible:underline">
              {mission.name}
            </Link>
          </h3>
          <p className="text-caption-1-regular text-text-secondary">Edited {relativeTime(mission.updatedAt)}</p>
        </div>
        <StatusChip m={mission} />
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <Stat label="Items" value={String(mission.waypointCount)} />
        <Stat label="Distance" value={mission.distanceM != null ? formatDistance(mission.distanceM) : '—'} />
        <Stat label="Time" value={mission.durationS != null ? formatDurationShort(mission.durationS) : '—'} />
      </dl>
      <div className="flex items-center gap-2 border-t border-separator-border pt-3">
        <ButtonLink href={href} size="small" variant="secondary" className="flex-1">
          Open
        </ButtonLink>
        <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownTrigger
            aria-label={`More actions for ${mission.name}`}
            className="flex size-8 items-center justify-center rounded-lg text-foreground-icon-secondary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <RiMore2Fill className="size-[18px]" aria-hidden />
          </DropdownTrigger>
          <DropdownPopover aria-label="Mission actions" placement="bottom end" className="w-[200px]">
            <DropdownItem onSelect={act('rename')}>Rename…</DropdownItem>
            <DropdownItem onSelect={act('duplicate')}>Duplicate</DropdownItem>
            <DropdownItem onSelect={act('export')}>Export…</DropdownItem>
            <DropdownDivider />
            <DropdownItem onSelect={act('delete')} className="text-red">
              Delete…
            </DropdownItem>
          </DropdownPopover>
        </Dropdown>
      </div>
    </article>
  );
}

export function MissionCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2lg border border-separator-border p-4" aria-hidden>
      <div className="h-[140px] animate-pulse rounded-lg bg-background-secondary-default" />
      <div className="h-5 w-2/3 animate-pulse rounded-md bg-background-secondary-default" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-md bg-background-secondary-default" />
        ))}
      </div>
      <div className="h-8 animate-pulse rounded-lg bg-background-secondary-default" />
    </div>
  );
}
