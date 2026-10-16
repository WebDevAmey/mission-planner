'use client';

import { Button } from '@/components/base/buttons/button';
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control';
import { useUIStore } from '@/lib/store/ui-store';
import type { ZoneKind } from '@/lib/store/editor-types';
import { FLOAT_PANEL } from '@/components/editor/editor-styles';
import { cx } from '@/utils/cx';
import { formatDistance } from './map-geo';
import { QuietButton } from '@/components/editor/quiet-button';

interface Props {
  info: { count: number; lengthM: number; radiusM: number };
  onFinish: () => void;
  onCancel: () => void;
}

/** One-line hint for the active tool, centred at the top of the map. Drawing
 * tools also get Finish / Cancel so nothing depends on keyboard or double-click. */
export function ToolHint({ info, onFinish, onCancel }: Props) {
  const tool = useUIStore((s) => s.activeTool);
  const zoneDraft = useUIStore((s) => s.zoneDraft);
  const setZoneDraft = useUIStore((s) => s.setZoneDraft);

  if (tool === 'select') return null;

  let text = '';
  let canFinish = false;
  switch (tool) {
    case 'add-wp':
      text = 'Click the map to add waypoints · drag to move · Esc to stop';
      break;
    case 'set-home':
      text = 'Click the map to set the home position · Esc to cancel';
      break;
    case 'draw-area':
      text =
        info.count < 3
          ? `Click to outline the survey area (${info.count}/3 points) · Esc to cancel`
          : `${info.count} points · click the first point or press Enter to finish`;
      canFinish = info.count >= 3;
      break;
    case 'draw-zone':
      if (zoneDraft.shape === 'circle') {
        text = info.radiusM > 0 ? `Radius ${formatDistance(info.radiusM)} · click to place` : 'Click the centre of the zone';
      } else {
        text = info.count < 3 ? `Click to outline the zone (${info.count}/3 points)` : `${info.count} points · click the first point or press Enter`;
        canFinish = info.count >= 3;
      }
      break;
    case 'measure':
      text = info.count === 0 ? 'Click points to measure a distance · Esc to clear' : `Total ${formatDistance(info.lengthM)} · Esc to clear`;
      break;
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center px-3 md:top-3 md:pl-[296px] xl:px-[296px]">
      <div
        role="status"
        aria-live="polite"
        className={cx(FLOAT_PANEL, 'pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 px-2 py-1.5')}
      >
        {tool === 'draw-zone' && (
          <>
            <SegmentedControl
              aria-label="Zone shape"
              selectedKeys={new Set([zoneDraft.shape])}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as 'polygon' | 'circle' | undefined;
                if (k) setZoneDraft({ shape: k });
              }}
            >
              <SegmentedControlItem id="polygon">Polygon</SegmentedControlItem>
              <SegmentedControlItem id="circle">Circle</SegmentedControlItem>
            </SegmentedControl>
            <SegmentedControl
              aria-label="Zone type"
              selectedKeys={new Set([zoneDraft.kind])}
              onSelectionChange={(keys) => {
                const k = [...keys][0] as ZoneKind | undefined;
                if (k) setZoneDraft({ kind: k });
              }}
            >
              <SegmentedControlItem id="keep_out">Keep-out</SegmentedControlItem>
              <SegmentedControlItem id="no_fly">No-fly</SegmentedControlItem>
              <SegmentedControlItem id="keep_in">Keep-in</SegmentedControlItem>
            </SegmentedControl>
          </>
        )}
        <span className="px-1 text-[13px] tabular-nums text-text-primary">{text}</span>
        {canFinish && (
          <Button size="xs" variant="secondary" onClick={onFinish}>
            Finish
          </Button>
        )}
        <QuietButton size="xs" onPress={onCancel}>
          {tool === 'measure' && info.count > 0 ? 'Clear' : 'Cancel'}
        </QuietButton>
      </div>
    </div>
  );
}
