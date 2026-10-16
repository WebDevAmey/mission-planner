'use client';

import React, { useState } from 'react';
import { MISSION_TEMPLATES, instantiateTemplate } from '@/lib/templates/mission-templates';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';
import { FOCUS_RING, INK_BUTTON, TONE_DOT } from '@/components/editor/editor-styles';

/** Where to anchor a template: home, else the first located item, else the map centre. */
function resolveAnchor(
  mission: ReturnType<typeof useMissionStore.getState>['mission'],
  mapView: { lat: number; lng: number } | null
): { lat: number; lng: number } | null {
  if (mission?.homePosition) return { lat: mission.homePosition.latitude, lng: mission.homePosition.longitude };
  const first = mission?.items.find((i) => i.latitude !== null && i.longitude !== null);
  if (first) return { lat: first.latitude!, lng: first.longitude! };
  return mapView;
}

/** Applies a template to the open mission: replaces its items (one undo step) and
 * keeps the mission id, so the editor never goes blank. */
export function TemplatePicker() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mission = useMissionStore((s) => s.mission);
  const applyChange = useMissionStore((s) => s.applyChange);
  const { setTemplatePickerOpen, addToast, mapView } = useUIStore();

  const selected = MISSION_TEMPLATES.find((t) => t.id === selectedId);
  const close = () => setTemplatePickerOpen(false);
  const replacing = (mission?.items.length ?? 0) > 0;

  const handleUse = () => {
    if (!selected || !mission) return;
    const anchor = resolveAnchor(mission, mapView);
    if (!anchor) {
      addToast('Set a home position or move the map to your site first', 'warning');
      return;
    }
    const items = instantiateTemplate(selected, anchor.lat, anchor.lng, mission.settings);
    applyChange(`Apply template "${selected.name}"`, (draft) => ({
      ...draft,
      items,
      homePosition: draft.homePosition ?? { latitude: anchor.lat, longitude: anchor.lng, altitude: 0 },
    }));
    addToast(`Applied template "${selected.name}". Undo to restore the previous items.`, 'success');
    close();
  };

  return (
    <Dialog open onClose={close} size="lg" className="flex max-h-[min(640px,90dvh)] w-[640px] max-w-[calc(100vw-32px)] flex-col">
      <DialogHeader onClose={close}>
        <DialogTitle className="text-[16px] font-medium">Start from a template</DialogTitle>
      </DialogHeader>

      {replacing && (
        <div className="flex items-center gap-2 border-b border-separator-border bg-background-secondary-default px-4 py-2 text-[13px] text-text-secondary" role="note">
          <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', TONE_DOT.warn)} />
          <span>
            This replaces the <span className="tabular-nums">{mission?.items.length}</span> items in this mission. You can undo it.
          </span>
        </div>
      )}

      <DialogBody className="grid flex-1 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
        {MISSION_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            type="button"
            onClick={() => setSelectedId(tmpl.id === selectedId ? null : tmpl.id)}
            aria-pressed={tmpl.id === selectedId}
            className={cx(
              'flex flex-col items-start gap-1 rounded-fd-control border p-3 text-left transition-colors duration-[120ms]',
              FOCUS_RING,
              tmpl.id === selectedId
                ? 'border-fd-accent bg-fd-accent-tint shadow-[inset_0_0_0_1px_var(--fd-accent)]'
                : 'border-separator-border bg-background-primary-default hover:border-fd-line-strong'
            )}
          >
            <span className="text-[14px] font-medium text-text-primary">{tmpl.name}</span>
            <span className="text-[13px] leading-snug text-text-secondary">{tmpl.description}</span>
            <span className="mt-1 text-[12px] tabular-nums text-text-tertiary">{tmpl.items.length} {tmpl.items.length === 1 ? 'item' : 'items'}</span>
          </button>
        ))}
      </DialogBody>

      <DialogFooter>
        <Button variant="secondary" size="small" onClick={close}>Cancel</Button>
        <Button variant="secondary" size="small" disabled={!selectedId} onClick={handleUse} className={INK_BUTTON}>
          {replacing ? 'Replace items' : 'Use template'}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
