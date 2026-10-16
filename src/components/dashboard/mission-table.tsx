'use client';

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table';
import { SkeletonBlock } from '@/components/common/skeleton-loader';
import { MissionActionsMenu, type CardAction } from './mission-card';
import { StatusLabel, distanceText, durationText, exactTime } from './mission-status';
import { relativeTime, type MissionSummary } from './types';

// .bui-table cell styles are unlayered CSS, so overrides here need `!`.
const HEAD = 'text-label-mono! uppercase text-text-tertiary!';
const NUM = 'text-end! tabular-nums';

/** Dense list view (BoardUI table). Row activation opens the mission. */
export function MissionTable({ missions, onAction }: { missions: MissionSummary[]; onAction: (a: CardAction, m: MissionSummary) => void }) {
  const router = useRouter();
  return (
    <div className="overflow-hidden rounded-md border border-separator-border bg-background-primary-default">
      <Table
        aria-label="Missions"
        size="sm"
        onRowAction={(key) => router.push(`/missions/${String(key)}`)}
        className="[&_th]:border-t-0!"
      >
        <TableHeader>
          <TableColumn isRowHeader className={`${HEAD} min-w-[200px]`}>
            Name
          </TableColumn>
          <TableColumn className={`${HEAD} text-end!`}>Waypoints</TableColumn>
          <TableColumn className={`${HEAD} text-end!`}>Distance</TableColumn>
          <TableColumn className={`${HEAD} text-end!`}>Est. time</TableColumn>
          <TableColumn className={HEAD}>Checks</TableColumn>
          <TableColumn className={`${HEAD} text-end!`}>Updated</TableColumn>
          <TableColumn className="w-12">
            <span className="sr-only">Actions</span>
          </TableColumn>
        </TableHeader>
        <TableBody items={missions}>
          {(m) => (
            <TableRow id={m.id} className="cursor-pointer hover:bg-background-secondary-default">
              <TableCell className="max-w-[320px] truncate text-body-2-medium!">{m.name}</TableCell>
              <TableCell className={`${NUM} text-body-2-regular!`}>{m.waypointCount}</TableCell>
              <TableCell className={`${NUM} text-body-2-regular!`}>{distanceText(m)}</TableCell>
              <TableCell className={`${NUM} text-body-2-regular!`}>{durationText(m)}</TableCell>
              <TableCell>
                <StatusLabel mission={m} />
              </TableCell>
              <TableCell className={`${NUM} whitespace-nowrap text-body-2-regular! text-text-secondary!`}>
                <time dateTime={m.updatedAt} title={exactTime(m.updatedAt)}>
                  {relativeTime(m.updatedAt)}
                </time>
              </TableCell>
              <TableCell className="py-0! text-end!">
                <MissionActionsMenu mission={m} onAction={onAction} />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function MissionTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-separator-border bg-background-primary-default" aria-hidden>
      <div className="flex h-9 items-center gap-6 border-b border-separator-border bg-background-secondary-default px-3">
        <SkeletonBlock className="h-2.5 w-16" />
        <div className="flex-1" />
        <SkeletonBlock className="h-2.5 w-40" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-6 border-b border-separator-border px-3 last:border-b-0">
          <SkeletonBlock className="h-3.5 w-48" />
          <div className="flex-1" />
          <SkeletonBlock className="h-3 w-56" />
        </div>
      ))}
    </div>
  );
}
