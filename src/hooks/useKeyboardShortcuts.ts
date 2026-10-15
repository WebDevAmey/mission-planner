'use client';

import { useEffect } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore, type MapTool } from '@/lib/store/ui-store';
import { useSaveStore } from '@/lib/store/save-store';

const TOOL_KEYS: Record<string, MapTool> = {
  v: 'select',
  a: 'add-wp',
  p: 'draw-area',
  z: 'draw-zone',
  h: 'set-home',
  m: 'measure',
};

export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['V'], label: 'Select and move' },
  { keys: ['A'], label: 'Add waypoints' },
  { keys: ['P'], label: 'Draw survey area' },
  { keys: ['Z'], label: 'Draw zone' },
  { keys: ['H'], label: 'Set home' },
  { keys: ['M'], label: 'Measure' },
  { keys: ['Enter'], label: 'Finish drawing' },
  { keys: ['Esc'], label: 'Cancel tool / clear selection' },
  { keys: ['Delete'], label: 'Delete selected item or zone' },
  { keys: ['Ctrl', 'Z'], label: 'Undo' },
  { keys: ['Ctrl', 'Shift', 'Z'], label: 'Redo (also Ctrl Y)' },
  { keys: ['Ctrl', 'S'], label: 'Save now' },
  { keys: [']'], label: 'Show or hide the inspector' },
  { keys: ['?'], label: 'Show this list' },
];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
}

/** Editor keyboard shortcuts (PRODUCT_SPEC §6.2). Ignored while typing or in dialogs. */
export function useMissionPlannerShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const ui = useUIStore.getState();
      const store = useMissionStore.getState();

      if (mod) {
        if (key === 's') {
          e.preventDefault();
          void useSaveStore.getState().flush();
          return;
        }
        if (isTyping(e.target)) return;
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          store.undo();
        } else if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault();
          store.redo();
        }
        return;
      }
      if (e.altKey || isTyping(e.target)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[role="dialog"],[role="menu"],[role="listbox"]')) return;

      if (TOOL_KEYS[key] && !e.shiftKey) {
        ui.setActiveTool(TOOL_KEYS[key]);
        return;
      }
      switch (e.key) {
        case '?':
          ui.setShortcutsOpen(true);
          return;
        case ']':
          ui.toggleInspector();
          return;
        case 'Escape':
          if (ui.activeTool !== 'select') ui.setActiveTool('select');
          else if (ui.planPanel) ui.openPlanPanel(null);
          else ui.resetSelection();
          return;
        case 'Delete':
        case 'Backspace': {
          if (ui.selectedMissionItemId) {
            e.preventDefault();
            store.deleteMissionItem(ui.selectedMissionItemId);
            ui.selectMissionItem(null);
            ui.addToast('Item deleted', 'info', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
          } else if (ui.selectedZoneId) {
            e.preventDefault();
            store.deleteZone(ui.selectedZoneId);
            ui.selectZone(null);
            ui.addToast('Zone deleted', 'info', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
