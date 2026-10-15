'use client';

import { useEffect, useCallback } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import type { MissionExportFormat } from '@/lib/services/mission-builder';

interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutAction[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isEditable =
        tagName === 'input' ||
        tagName === 'textarea' ||
        target?.getAttribute('contenteditable') === 'true';

      if (isEditable && !event.metaKey && !event.ctrlKey) {
        return;
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = Boolean(shortcut.ctrl) === (event.ctrlKey || event.metaKey);
        const shiftMatch = Boolean(shortcut.shift) === event.shiftKey;
        const altMatch = Boolean(shortcut.alt) === event.altKey;
        const keyMatch = shortcut.key.toLowerCase() === event.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export function useMissionPlannerShortcuts() {
  const { undo, redo, mission, exportMission: storeExport, deleteMissionItem } =
    useMissionStore();
  const {
    resetSelection, setActiveTool, selectedMissionItemId, addToast,
    toggleTemplatePicker, toggleTimeline, toggleGeofencePanel,
  } = useUIStore();

  const handleExport = useCallback(() => {
    if (!mission) {
      addToast('No mission to export', 'error');
      return;
    }
    if (mission.items.length === 0) {
      addToast('⚠ Export blocked — empty mission', 'error');
      return;
    }
    const payload = storeExport('json' as MissionExportFormat);
    if (!payload) return;
    const blob = new Blob([payload.content], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${mission.name.replace(/\s+/g, '_')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    addToast(`✓ Exported ${mission.name}.json`, 'success');
  }, [mission, storeExport, addToast]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedMissionItemId) return;
    deleteMissionItem(selectedMissionItemId);
    addToast('Waypoint deleted', 'info');
  }, [selectedMissionItemId, deleteMissionItem, addToast]);

  const handleUndo = useCallback(() => {
    undo();
    addToast('Undo', 'info');
  }, [undo, addToast]);

  const handleRedo = useCallback(() => {
    redo();
    addToast('Redo', 'info');
  }, [redo, addToast]);

  useKeyboardShortcuts([
    { key: 'z', ctrl: true, action: handleUndo },
    { key: 'z', ctrl: true, shift: true, action: handleRedo },
    { key: 'y', ctrl: true, action: handleRedo },
    { key: 's', ctrl: true, action: handleExport },
    { key: 'Delete', action: handleDeleteSelected },
    { key: 'Backspace', action: handleDeleteSelected },
    { key: 'Escape', action: resetSelection },
    { key: 'a', action: () => setActiveTool('add-wp') },
    { key: 'r', action: () => setActiveTool('remove-wp') },
    { key: 's', action: () => setActiveTool('select') },
    { key: 'w', action: () => setActiveTool('add-wp') },
    { key: 'd', action: () => setActiveTool('remove-wp') },
    // Part 9 additions
    { key: 't', ctrl: true, action: toggleTimeline },
    { key: 't', action: toggleTemplatePicker },
    { key: 'g', action: toggleGeofencePanel },
  ]);
}
