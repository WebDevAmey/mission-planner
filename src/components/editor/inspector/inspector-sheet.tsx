'use client';

import { useRef, useState } from 'react';
import { useUIStore } from '@/lib/store/ui-store';
import { cx } from '@/utils/cx';
import { Inspector } from './inspector';

type Snap = 'peek' | 'half' | 'full';

/** Collapsed sheet height (24px handle + 53px section switcher); the map stops above it. */
export const SHEET_PEEK_INSET = 'max-md:bottom-[77px]';
const ORDER: Snap[] = ['peek', 'half', 'full'];
const LABEL: Record<Snap, string> = { peek: 'collapsed', half: 'half height', full: 'full height' };
const HEIGHT: Record<Snap, string> = {
  peek: 'h-[77px]',
  half: 'h-[52%]',
  full: 'h-[calc(100%-12px)]',
};

/**
 * Phone inspector (DESIGN_SPEC §5.4): a bottom sheet over the map with three snap
 * points. Collapsed shows the section switcher; picking a section, selecting a
 * waypoint or pressing the handle raises it. The handle is a real button:
 * Enter/Space cycles, Arrow Up/Down step, Escape collapses; pointer drag snaps.
 */
export function InspectorSheet() {
  const open = useUIStore((s) => s.inspectorOpen);
  const setOpen = useUIStore((s) => s.setInspectorOpen);
  const [full, setFull] = useState(false);
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const snap: Snap = !open ? 'peek' : full ? 'full' : 'half';

  const go = (next: Snap) => {
    setOpen(next !== 'peek');
    setFull(next === 'full');
  };
  const step = (dir: 1 | -1) => go(ORDER[Math.min(2, Math.max(0, ORDER.indexOf(snap) + dir))]);
  const nextLabel = snap === 'full' ? 'Collapse' : 'Expand';

  return (
    <div
      className={cx(
        'absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-[10px] border-t border-separator-border bg-background-primary-default shadow-fd-float',
        'transition-[height] duration-[280ms] ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none',
        HEIGHT[snap]
      )}
    >
      <Inspector
        showClose={false}
        className="min-h-0 flex-1"
        header={
          <button
            type="button"
            aria-label={`Inspector, ${LABEL[snap]}. ${nextLabel}`}
            aria-expanded={snap !== 'peek'}
            onClick={() => {
              if (drag.current?.moved) return;
              go(snap === 'full' ? 'peek' : snap === 'peek' ? 'half' : 'full');
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                step(1);
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                step(-1);
              } else if (e.key === 'Escape' && snap !== 'peek') {
                e.preventDefault();
                go('peek');
              }
            }}
            onPointerDown={(e) => {
              drag.current = { y: e.clientY, moved: false };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (drag.current && Math.abs(e.clientY - drag.current.y) > 6) drag.current.moved = true;
            }}
            onPointerUp={(e) => {
              const d = drag.current;
              if (!d) return;
              const dy = e.clientY - d.y;
              if (d.moved) {
                if (dy < -240) go('full');
                else if (dy < -40) step(1);
                else if (dy > 240) go('peek');
                else if (dy > 40) step(-1);
                // Let the click that follows a drag be ignored, then reset.
                setTimeout(() => (drag.current = null), 0);
              } else drag.current = null;
            }}
            className="flex h-6 w-full shrink-0 touch-none items-center justify-center outline-none focus-visible:bg-background-primary-hover"
          >
            <span aria-hidden className="h-1 w-9 rounded-full bg-border-button-hover" />
          </button>
        }
      />
    </div>
  );
}
