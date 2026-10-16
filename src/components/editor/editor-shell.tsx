'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { RiCloseLine } from '@remixicon/react';
import { useUIStore } from '@/lib/store/ui-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { useMissionPlannerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useTerrainProfile } from '@/hooks/useTerrainProfile';
import { TerrainPanel } from '@/components/mission/terrain-panel';
import { ToastContainer } from '@/components/common/toast';
import { cx } from '@/utils/cx';
import { EditorHeader } from './editor-header';
import { ToolRail } from './tool-rail';
import { StatusBar } from './status-bar';
import { Inspector } from './inspector/inspector';
import { InspectorSheet, SHEET_PEEK_INSET } from './inspector/inspector-sheet';
import { ICON_BUTTON } from './editor-styles';

/** Same surface as the loading skeleton's map area, so the swap is invisible. */
function MapPlaceholder() {
  return <div aria-hidden className="size-full bg-background-secondary-default" />;
}

// MapLibre (~270 KB gzip) is only needed in the editor and only in the browser.
export const loadMissionMap = () => import('@/components/map/mission-map');
const MissionMap = dynamic(() => loadMissionMap().then((m) => m.MissionMap), {
  ssr: false,
  loading: MapPlaceholder,
});
// Opened on demand; kept out of the editor's first-load JS.
const AgentConsole = dynamic(() => import('@/components/agent-console/agent-console').then((m) => m.AgentConsole), {
  ssr: false,
});
const ShortcutsDialog = dynamic(() => import('./shortcuts-dialog').then((m) => m.ShortcutsDialog), { ssr: false });
const TemplatePicker = dynamic(() => import('@/components/mission/template-picker').then((m) => m.TemplatePicker), {
  ssr: false,
});
const ParamTable = dynamic(() => import('./param-table').then((m) => m.ParamTable), { ssr: false });

/** True once `flag` has been true; lets a dialog keep its exit animation after the first open. */
function useHasBeenTrue(flag: boolean) {
  const [seen, setSeen] = useState(flag);
  if (flag && !seen) setSeen(true);
  return seen || flag;
}

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
  const consoleOpen = useAgentStore((s) => s.consoleOpen);
  const shortcutsMounted = useHasBeenTrue(useUIStore((s) => s.shortcutsOpen));
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
      {consoleOpen && <AgentConsole />}
      {shortcutsMounted && <ShortcutsDialog />}
      {templatePickerOpen && <TemplatePicker />}
      <ToastContainer />
    </div>
  );
}
