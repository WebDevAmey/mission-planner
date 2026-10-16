'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionPlannerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTerrainProfile } from '@/hooks/useTerrainProfile';
import { MissionMap } from '@/components/map/mission-map';
import { TerrainPanel } from '@/components/mission/terrain-panel';
import { TemplatePicker } from '@/components/mission/template-picker';
import { AgentConsole } from '@/components/agent-console/agent-console';
import { ToastContainer } from '@/components/common/toast';
import { cx } from '@/utils/cx';
import { EditorHeader } from './editor-header';
import { ToolRail } from './tool-rail';
import { StatusBar } from './status-bar';
import { Inspector } from './inspector/inspector';
import { InspectorSheet, SHEET_PEEK_INSET } from './inspector/inspector-sheet';
import { ParamTable } from './param-table';
import { ShortcutsDialog } from './shortcuts-dialog';
import { ICON_BUTTON } from './editor-styles';

function PhoneBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div role="note" className="flex items-center gap-2 border-b border-separator-border bg-background-secondary-default py-1 pl-4 pr-1 md:hidden">
      <p className="flex-1 text-[12px] text-text-secondary">Review and make small edits here. Planning is easier on a larger screen.</p>
      <button type="button" aria-label="Dismiss" onClick={() => setDismissed(true)} className={ICON_BUTTON}>
        <RiCloseLine className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** True below the given width (client only; false during SSR / first paint). */
function useNarrow(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false
  );
}

/**
 * Editor layout (DESIGN_SPEC §5.4): 48px header; 48px tool rail, full-bleed map and a
 * 360px inspector; 32px status bar. Terrain and the parameter table open upward
 * from the status bar. 768–1023px: the inspector is a drawer over the map.
 * Below 768px: map full screen, inspector as a bottom sheet, tools as a bottom toolbar.
 */
export function EditorShell() {
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const terrainOpen = useUIStore((s) => s.terrainOpen);
  const paramTableOpen = useUIStore((s) => s.paramTableOpen);
  const templatePickerOpen = useUIStore((s) => s.templatePickerOpen);
  const setInspectorOpen = useUIStore((s) => s.setInspectorOpen);
  const phone = useNarrow('(max-width: 767px)');

  useMissionPlannerShortcuts();
  useTerrainProfile();

  // Start with the drawer / sheet closed on narrower screens so the map stays usable.
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) setInspectorOpen(false);
  }, [setInspectorOpen]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background-primary-default text-text-primary">
      <EditorHeader />
      <PhoneBanner />
      <div className="relative flex min-h-0 flex-1">
        <ToolRail className="hidden md:flex" />
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div className={cx('absolute inset-0', SHEET_PEEK_INSET)}>
              <MissionMap />
            </div>
            {phone && <InspectorSheet />}
          </div>
          {terrainOpen && <TerrainPanel />}
          {paramTableOpen && <ParamTable />}
        </main>
        {!phone && inspectorOpen && (
          <>
            <button
              type="button"
              aria-label="Close inspector"
              tabIndex={-1}
              onClick={() => setInspectorOpen(false)}
              className="absolute inset-0 z-20 bg-text-primary/20 lg:hidden"
            />
            <Inspector className="absolute inset-y-0 right-0 z-30 w-[360px] max-w-full border-l border-separator-border shadow-fd-float lg:static lg:z-auto lg:shadow-none" />
          </>
        )}
      </div>
      <StatusBar />
      <ToolRail orientation="horizontal" className="md:hidden" />
      <AgentConsole />
      <ShortcutsDialog />
      {templatePickerOpen && <TemplatePicker />}
      <ToastContainer />
    </div>
  );
}
