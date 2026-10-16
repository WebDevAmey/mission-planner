'use client';

import {
  type RemixiconComponentType,
  RiCursorLine,
  RiEarthLine,
  RiFocus3Line,
  RiHome4Line,
  RiMapPinAddLine,
  RiRulerLine,
  RiShapeLine,
  RiShieldLine,
} from '@remixicon/react';
import { Button as AriaButton, ToggleButton } from 'react-aria-components';
import { Kbd } from '@/components/base/kbd/kbd';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { useUIStore, type MapTool } from '@/lib/store/ui-store';
import { cx } from '@/utils/cx';
import { FOCUS_RING_INSET } from './editor-styles';

export const TOOLS: { id: MapTool; label: string; key: string; icon: RemixiconComponentType }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: RiCursorLine },
  { id: 'add-wp', label: 'Waypoint', key: 'A', icon: RiMapPinAddLine },
  { id: 'draw-area', label: 'Survey area', key: 'P', icon: RiShapeLine },
  { id: 'draw-zone', label: 'Zone', key: 'Z', icon: RiShieldLine },
  { id: 'set-home', label: 'Set home', key: 'H', icon: RiHome4Line },
  { id: 'measure', label: 'Measure', key: 'M', icon: RiRulerLine },
];

const BTN = cx(
  'flex shrink-0 items-center justify-center rounded-md transition-colors duration-[120ms]',
  'size-11 md:size-9',
  FOCUS_RING_INSET
);
const IDLE = 'text-text-secondary hover:bg-background-primary-hover hover:text-text-primary';
/** Active tool: ink fill, surface icon (DESIGN_SPEC §5.4; accent is reserved for Export and selection). */
const ACTIVE = 'bg-text-primary text-background-primary-default';

/** 48px tool rail: left column on desktop and tablet, bottom toolbar on phones. */
export function ToolRail({ orientation = 'vertical', className }: { orientation?: 'vertical' | 'horizontal'; className?: string }) {
  const active = useUIStore((s) => s.activeTool);
  const setTool = useUIStore((s) => s.setActiveTool);
  const mapStyle = useUIStore((s) => s.mapStyle);
  const setMapStyle = useUIStore((s) => s.setMapStyle);
  const focusMap = useUIStore((s) => s.focusMap);
  const vertical = orientation === 'vertical';
  const tip = vertical ? 'right' : 'top';

  return (
    <nav
      aria-label="Map tools"
      className={cx(
        'flex shrink-0 gap-1 bg-background-primary-default',
        vertical
          ? 'w-12 flex-col items-center border-r border-separator-border py-2'
          : 'h-14 flex-row items-center justify-between border-t border-separator-border px-1 pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      {TOOLS.map(({ id, label, key, icon: Icon }) => (
        <TooltipTrigger key={id} delay={300}>
          <ToggleButton
            aria-label={label}
            aria-keyshortcuts={key}
            isSelected={active === id}
            onChange={() => setTool(active === id && id !== 'select' ? 'select' : id)}
            className={({ isSelected }) => cx(BTN, isSelected ? ACTIVE : IDLE)}
          >
            <Icon className="size-[18px]" aria-hidden />
          </ToggleButton>
          <Tooltip placement={tip}>
            <span className="flex items-center gap-2">
              {label}
              <Kbd>{key}</Kbd>
            </span>
          </Tooltip>
        </TooltipTrigger>
      ))}

      <span aria-hidden className={cx('shrink-0 bg-separator-border', vertical ? 'my-1 h-px w-6' : 'mx-0.5 h-6 w-px')} />

      <TooltipTrigger delay={300}>
        <ToggleButton
          aria-label="Satellite imagery"
          isSelected={mapStyle === 'satellite'}
          onChange={(on) => setMapStyle(on ? 'satellite' : 'vector')}
          className={({ isSelected }) => cx(BTN, isSelected ? 'bg-background-primary-active text-text-primary' : IDLE)}
        >
          <RiEarthLine className="size-[18px]" aria-hidden />
        </ToggleButton>
        <Tooltip placement={tip}>{mapStyle === 'satellite' ? 'Satellite on: switch to map' : 'Map: switch to satellite'}</Tooltip>
      </TooltipTrigger>
      <TooltipTrigger delay={300}>
        <AriaButton aria-label="Fit route" onPress={() => focusMap({ kind: 'route' })} className={cx(BTN, IDLE)}>
          <RiFocus3Line className="size-[18px]" aria-hidden />
        </AriaButton>
        <Tooltip placement={tip}>Fit route</Tooltip>
      </TooltipTrigger>
    </nav>
  );
}
