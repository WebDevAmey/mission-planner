'use client';

import type { Key } from 'react-aria-components';
import { RiSideBarLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Tab, TabList, TabPanel, Tabs } from '@/components/base/tabs/tabs';
import { useUIStore, type InspectorTab } from '@/lib/store/ui-store';
import { useTerrainStore } from '@/lib/store/terrain-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { cx } from '@/utils/cx';
import { WaypointsTab } from './waypoints-tab';
import { ItemTab } from './item-tab';
import { ChecksTab } from './checks-tab';
import { SettingsTab } from './settings-tab';

function TerrainNote() {
  const status = useTerrainStore((s) => s.status);
  if (status === 'ready' || status === 'idle') return null;
  return (
    <p className="px-4 pb-4 text-caption-1-regular text-text-tertiary" role="status">
      {status === 'loading' ? 'Checking terrain clearance…' : 'Terrain data unavailable: clearance is not being checked.'}
    </p>
  );
}

/** 320px inspector: Waypoints / Item / Checks / Settings (PRODUCT_SPEC §6.2). */
export function Inspector({ className }: { className?: string }) {
  const tab = useUIStore((s) => s.inspectorTab);
  const setTab = useUIStore((s) => s.setInspectorTab);
  const setOpen = useUIStore((s) => s.setInspectorOpen);
  const analysis = useMissionAnalysis();
  const issueCount = analysis ? analysis.errors + analysis.warnings : 0;

  return (
    <aside aria-label="Inspector" className={cx('flex min-h-0 flex-col bg-background-primary-default', className)}>
      <Tabs selectedKey={tab} onSelectionChange={(k: Key) => setTab(k as InspectorTab)} className="min-h-0 flex-1 gap-0">
        <div className="flex shrink-0 items-end gap-1 pe-2 ps-2 pt-2">
          <TabList aria-label="Inspector sections" className="flex-1 gap-0">
            <Tab id="waypoints">Waypoints</Tab>
            <Tab id="item">Item</Tab>
            <Tab id="checks" count={issueCount > 0 ? issueCount : undefined}>
              Checks
            </Tab>
            <Tab id="settings">Settings</Tab>
          </TabList>
          <Button
            size="small"
            variant="ghost"
            iconOnly
            leadingIcon={RiSideBarLine}
            aria-label="Hide inspector (])"
            onClick={() => setOpen(false)}
            className="mb-1"
          />
        </div>
        <TabPanel id="waypoints" className="flex min-h-0 flex-1 flex-col pt-3">
          <WaypointsTab />
        </TabPanel>
        <TabPanel id="item" className="min-h-0 flex-1 overflow-y-auto pt-4">
          <ItemTab />
        </TabPanel>
        <TabPanel id="checks" className="min-h-0 flex-1 overflow-y-auto pt-3">
          <ChecksTab />
          <TerrainNote />
        </TabPanel>
        <TabPanel id="settings" className="min-h-0 flex-1 overflow-y-auto pt-4">
          <SettingsTab />
        </TabPanel>
      </Tabs>
    </aside>
  );
}
