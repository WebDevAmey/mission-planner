'use client';

import { useEffect, useRef } from 'react';
import { RiClipboardLine, RiHome4Line, RiMapPinAddLine } from '@remixicon/react';
import { MENU_ITEM, MENU_ITEM_INTERACTIVE } from '@/components/base/dropdown/menu-styles';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { PlannerAction } from '@/lib/mavlink/commands';
import { round7 } from '@/lib/utils';
import { cx } from '@/utils/cx';
import { DATA_MONO, FLOAT_PANEL } from '@/components/editor/editor-styles';

export interface ContextMenuState {
  x: number;
  y: number;
  lngLat: [number, number];
  width: number;
  height: number;
}

/** Right-click menu on the map: add a waypoint or set home at the cursor. */
export function MapContextMenu({ state, onClose }: { state: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [lng, lat] = state.lngLat;

  useEffect(() => {
    ref.current?.querySelector('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const left = Math.min(state.x, state.width - 232);
  const top = Math.min(state.y, state.height - 160);

  const act = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const items = [
    {
      icon: RiMapPinAddLine,
      label: 'Add waypoint here',
      run: () => {
        const m = useMissionStore.getState().mission;
        const id = useMissionStore.getState().addMissionItem(PlannerAction.WAYPOINT, {
          coordinate: { latitude: round7(lat), longitude: round7(lng), altitude: m?.settings.defaultAltitude ?? 80 },
        });
        if (id) useUIStore.getState().selectMissionItem(id);
      },
    },
    {
      icon: RiHome4Line,
      label: 'Set home here',
      run: () => useMissionStore.getState().setHomePosition({ latitude: round7(lat), longitude: round7(lng), altitude: 0 }),
    },
    {
      icon: RiClipboardLine,
      label: 'Copy coordinates',
      run: () => {
        void navigator.clipboard?.writeText(`${lat.toFixed(7)}, ${lng.toFixed(7)}`);
        useUIStore.getState().addToast('Coordinates copied', 'success');
      },
    },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Map actions"
      // Position follows the cursor; it can't be expressed as a static class.
      style={{ left, top }}
      className={cx(FLOAT_PANEL, 'absolute z-20 flex w-56 flex-col gap-0.5 p-1.5')}
    >
      {items.map(({ icon: Icon, label, run }) => (
        <button key={label} type="button" role="menuitem" onClick={act(run)} className={cx(MENU_ITEM, MENU_ITEM_INTERACTIVE, 'rounded-md px-2 py-1.5 text-[14px]')}>
          <Icon className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          {label}
        </button>
      ))}
      <p className={cx(DATA_MONO, 'border-t border-separator-border px-2 pb-1 pt-1.5 text-[11px] text-text-tertiary')}>
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </p>
    </div>
  );
}
