'use client';

import {
  type RemixiconComponentType,
  RiCursorLine,
  RiHome4Line,
  RiMapPinAddLine,
  RiRulerLine,
  RiShapeLine,
  RiShieldLine,
} from '@remixicon/react';
import { ToggleButton } from 'react-aria-components';
import { Kbd } from '@/components/base/kbd/kbd';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { useUIStore, type MapTool } from '@/lib/store/ui-store';
import { cx } from '@/utils/cx';

export const TOOLS: { id: MapTool; label: string; key: string; icon: RemixiconComponentType }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: RiCursorLine },
  { id: 'add-wp', label: 'Add waypoint', key: 'A', icon: RiMapPinAddLine },
  { id: 'draw-area', label: 'Draw survey area', key: 'P', icon: RiShapeLine },
  { id: 'draw-zone', label: 'Draw zone', key: 'Z', icon: RiShieldLine },
  { id: 'set-home', label: 'Set home', key: 'H', icon: RiHome4Line },
  { id: 'measure', label: 'Measure', key: 'M', icon: RiRulerLine },
];

/** 48px tool rail (desktop: left column; tablet: bottom bar). */
export function ToolRail({ orientation = 'vertical', className }: { orientation?: 'vertical' | 'horizontal'; className?: string }) {
  const active = useUIStore((s) => s.activeTool);
  const setTool = useUIStore((s) => s.setActiveTool);

  return (
    <nav
      aria-label="Map tools"
      className={cx(
        'flex shrink-0 gap-1 bg-background-secondary-default p-1.5',
        orientation === 'vertical' ? 'w-12 flex-col items-center border-r border-separator-border' : 'h-12 flex-row items-center justify-center border-t border-separator-border',
        className
      )}
    >
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <TooltipTrigger key={id}>
          <ToggleButton
            aria-label={label}
            aria-keyshortcuts={key}
            isSelected={active === id}
            onChange={() => setTool(active === id && id !== 'select' ? 'select' : id)}
            className={({ isSelected }) =>
              cx(
                'flex size-9 items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-border-focus-ring',
                isSelected
                  ? 'bg-accent-600 text-white'
                  : 'text-foreground-icon-secondary hover:bg-background-primary-hover hover:text-foreground-icon-primary'
              )
            }
          >
            <Icon className="size-5" aria-hidden />
          </ToggleButton>
          <Tooltip placement={orientation === 'vertical' ? 'right' : 'top'}>
            <span className="flex items-center gap-2">
              {label}
              <Kbd>{key}</Kbd>
            </span>
          </Tooltip>
        </TooltipTrigger>
      ))}
    </nav>
  );
}
