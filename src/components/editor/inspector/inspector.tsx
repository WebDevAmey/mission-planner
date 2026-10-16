'use client';

import type { ReactNode } from 'react';
import { Tab, TabList, TabPanel, Tabs, type Key } from 'react-aria-components';
import { RiCloseLine } from '@remixicon/react';
import { Button as AriaButton } from 'react-aria-components';
import { useUIStore, type InspectorTab } from '@/lib/store/ui-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { cx } from '@/utils/cx';
import { FOCUS_RING_INSET, ICON_BUTTON, TONE_DOT } from '../editor-styles';
import { WaypointsTab } from './waypoints-tab';
import { ItemTab } from './item-tab';
import { ChecksTab } from './checks-tab';
import { SettingsTab } from './settings-tab';

function TerrainNote() {
  const status = useTerrainStore((s) => s.status);
  if (status === 'ready' || status === 'idle') return null;
  return (
    <p className="px-4 pb-4 text-[13px] text-text-tertiary" role="status">
      {status === 'loading' ? 'Checking terrain clearance…' : 'Terrain data unavailable: clearance is not being checked.'}
    </p>
  );
}

const SEGMENT = cx(
  'relative flex h-7 max-md:h-9 flex-1 cursor-default items-center justify-center gap-1.5 rounded-[5px] px-2 text-[13px] text-text-secondary transition-colors duration-[120ms]',
  'hover:text-text-primary data-[selected]:bg-background-primary-default data-[selected]:font-medium data-[selected]:text-text-primary data-[selected]:shadow-[0_0_0_1px_var(--color-separator-border)]',
  FOCUS_RING_INSET
);

function Segment({ id, children }: { id: InspectorTab; children: ReactNode }) {
  return (
    <Tab id={id} className={SEGMENT}>
      {children}
    </Tab>
  );
}

/**
 * Inspector (DESIGN_SPEC §5.4): Waypoints / Item / Checks / Settings as a
 * segmented control over dense panels. 360px column on desktop; the editor shell
 * hosts it in a drawer (tablet) or a bottom sheet (phone) and passes `header`.
 */
export function Inspector({ className, header, showClose = true }: { className?: string; header?: ReactNode; showClose?: boolean }) {
  const tab = useUIStore((s) => s.inspectorTab);
  const setTab = useUIStore((s) => s.setInspectorTab);
  const setOpen = useUIStore((s) => s.setInspectorOpen);
  const analysis = useMissionAnalysis();
  const errors = analysis?.errors ?? 0;
  const issueCount = analysis ? analysis.errors + analysis.warnings : 0;

  return (
    <aside aria-label="Inspector" className={cx('flex min-h-0 flex-col bg-background-primary-default', className)}>
      {header}
      <Tabs selectedKey={tab} onSelectionChange={(k: Key) => setTab(k as InspectorTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-1 border-b border-separator-border px-3 py-2 max-md:py-1.5">
          <TabList aria-label="Inspector sections" className="flex flex-1 gap-0.5 rounded-md bg-background-secondary-default p-0.5">
            <Segment id="waypoints">Waypoints</Segment>
            <Segment id="item">Item</Segment>
            <Segment id="checks">
              Checks
              {issueCount > 0 && (
                <span className="flex items-center gap-1 tabular-nums">
                  <span aria-hidden className={cx('size-1.5 rounded-full', errors > 0 ? TONE_DOT.danger : TONE_DOT.warn)} />
                  {issueCount}
                  <span className="sr-only"> issue{issueCount === 1 ? '' : 's'}</span>
                </span>
              )}
            </Segment>
            <Segment id="settings">Settings</Segment>
          </TabList>
          {showClose && (
            <AriaButton aria-label="Hide inspector" aria-keyshortcuts="]" onPress={() => setOpen(false)} className={ICON_BUTTON}>
              <RiCloseLine className="size-4" aria-hidden />
            </AriaButton>
          )}
        </div>
        <TabPanel id="waypoints" className="flex min-h-0 flex-1 flex-col outline-none">
          <WaypointsTab />
        </TabPanel>
        <TabPanel id="item" className="min-h-0 flex-1 overflow-y-auto pt-3 outline-none">
          <ItemTab />
        </TabPanel>
        <TabPanel id="checks" className="min-h-0 flex-1 overflow-y-auto pt-2 outline-none">
          <ChecksTab />
          <TerrainNote />
        </TabPanel>
        <TabPanel id="settings" className="min-h-0 flex-1 overflow-y-auto pt-3 outline-none">
          <SettingsTab />
        </TabPanel>
      </Tabs>
    </aside>
  );
}
