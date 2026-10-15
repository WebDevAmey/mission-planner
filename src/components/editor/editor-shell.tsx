'use client';

import { useEffect, useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionPlannerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTerrainProfile } from '@/hooks/useTerrainProfile';
import { MissionMap } from '@/components/map/mission-map';
import { TerrainPanel } from '@/components/mission/terrain-panel';
import { TemplatePicker } from '@/components/mission/template-picker';
import { AgentConsole } from '@/components/agent-console/agent-console';
import { ToastContainer } from '@/components/common/toast';
import { EditorHeader } from './editor-header';
import { ToolRail } from './tool-rail';
import { StatusBar } from './status-bar';
import { Inspector } from './inspector/inspector';
import { ParamTable } from './param-table';
import { ShortcutsDialog } from './shortcuts-dialog';

function PhoneBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div role="note" className="flex items-center gap-2 border-b border-separator-border bg-background-secondary-default px-4 py-2 md:hidden">
      <p className="flex-1 text-caption-1-regular text-text-secondary">Planning works best on a tablet or computer. You can review and make small edits here.</p>
      <Button
        size="xs"
        variant="ghost"
        iconOnly
        leadingIcon={RiCloseLine}
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
      />
    </div>
  );
}

/**
 * Editor layout (PRODUCT_SPEC §6.2): 56px header, 48px tool rail, map, 320px inspector,
 * 40px status bar. Terrain and the parameter table open upward from the status bar.
 * Below 1280px the inspector is an overlay drawer; below 1024px the rail moves to the bottom.
 */
export function EditorShell() {
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const terrainOpen = useUIStore((s) => s.terrainOpen);
  const paramTableOpen = useUIStore((s) => s.paramTableOpen);
  const templatePickerOpen = useUIStore((s) => s.templatePickerOpen);
  const setInspectorOpen = useUIStore((s) => s.setInspectorOpen);

  useMissionPlannerShortcuts();
  useTerrainProfile();

  // Start with the drawer closed on narrow screens so the map stays usable.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1279px)').matches) setInspectorOpen(false);
  }, [setInspectorOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background-primary-default text-text-primary">
      <EditorHeader />
      <PhoneBanner />
      <div className="relative flex min-h-0 flex-1">
        <ToolRail className="hidden lg:flex" />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <MissionMap />
          </div>
          <ToolRail orientation="horizontal" className="lg:hidden" />
          {terrainOpen && <TerrainPanel />}
          {paramTableOpen && <ParamTable />}
        </main>
        {inspectorOpen && (
          <>
            <button
              type="button"
              aria-label="Close inspector"
              tabIndex={-1}
              onClick={() => setInspectorOpen(false)}
              className="absolute inset-0 z-20 bg-black/30 xl:hidden"
            />
            <Inspector className="absolute inset-y-0 right-0 z-30 w-full border-l border-separator-border shadow-2xl sm:w-80 xl:static xl:z-auto xl:shadow-none" />
          </>
        )}
      </div>
      <StatusBar />
      <AgentConsole />
      <ShortcutsDialog />
      {templatePickerOpen && <TemplatePicker />}
      <ToastContainer />
    </div>
  );
}
