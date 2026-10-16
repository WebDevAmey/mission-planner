'use client';

import { useMemo, useRef, useState } from 'react';
import {
  RiAddLine,
  RiAlertLine,
  RiArrowDownSLine,
  RiDraggable,
  RiErrorWarningLine,
  RiFlowChart,
  RiTableLine,
} from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { buttonStyles } from '@/components/base/buttons/button';
import { Dropdown, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { COMMAND_SHORT_LABELS, PlannerAction, supportsCoordinates } from '@/lib/mavlink/commands';
import { haversineM } from '@/lib/domain/geo';
import { severityByItem, formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';
import { FOCUS_RING_INSET, LABEL_MONO, MENU_PANEL, ROW, ROW_SELECTED, TONE_TEXT } from '../editor-styles';
import { PlanPanelHost } from '../planning/plan-panel-host';

const ADD_OPTIONS: { action: PlannerAction; label: string }[] = [
  { action: PlannerAction.WAYPOINT, label: 'Waypoint' },
  { action: PlannerAction.TAKEOFF, label: 'Takeoff' },
  { action: PlannerAction.LOITER, label: 'Loiter (time)' },
  { action: PlannerAction.LAND, label: 'Land' },
  { action: PlannerAction.RTL, label: 'Return to launch' },
  { action: PlannerAction.SET_SPEED, label: 'Change speed' },
  { action: PlannerAction.CAM_TRIGG_DIST, label: 'Camera trigger distance' },
  { action: PlannerAction.SET_ROI, label: 'Point camera at (ROI)' },
  { action: PlannerAction.WAIT, label: 'Wait' },
  { action: PlannerAction.DO_JUMP, label: 'Jump to item' },
];

/** Item number: spatial items get the map's waypoint circle; commands a plain number. */
export function ItemBadge({ n, kind, selected }: { n: number; kind: 'spatial' | 'command'; selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 font-mono text-[11px] font-medium tabular-nums',
        kind === 'spatial'
          ? selected
            ? 'bg-(--fd-accent) text-(color:--fd-accent-ink)'
            : 'border-[1.5px] border-text-primary text-text-primary'
          : 'text-text-tertiary'
      )}
    >
      {n}
    </span>
  );
}

export function WaypointsTab() {
  const mission = useMissionStore((s) => s.mission);
  const addMissionItem = useMissionStore((s) => s.addMissionItem);
  const reorder = useMissionStore((s) => s.reorderMissionItems);
  const selectedId = useUIStore((s) => s.selectedMissionItemId);
  const { selectMissionItem, setActiveTool, setParamTableOpen, setTemplatePickerOpen, openPlanPanel, focusMap, addToast, setInspectorTab } =
    useUIStore();
  const planPanel = useUIStore((s) => s.planPanel);
  const surveyArea = useUIStore((s) => s.surveyArea);
  const analysis = useMissionAnalysis();
  const [addOpen, setAddOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const severity = useMemo(() => severityByItem(analysis?.issues ?? []), [analysis]);

  const rows = useMemo(() => {
    if (!mission) return [];
    let prev: [number, number] | null = mission.homePosition ? [mission.homePosition.longitude, mission.homePosition.latitude] : null;
    return mission.items.map((item, index) => {
      const spatial = supportsCoordinates(item.action) && item.latitude !== null && item.longitude !== null;
      let legM: number | null = null;
      if (spatial) {
        const pos: [number, number] = [item.longitude!, item.latitude!];
        if (prev) legM = haversineM(prev, pos);
        prev = pos;
      }
      return { item, index, spatial, legM };
    });
  }, [mission]);

  if (!mission) return null;
  if (planPanel) return <PlanPanelHost />;

  const add = (action: PlannerAction) => {
    setAddOpen(false);
    const selIndex = selectedId ? mission.items.findIndex((i) => i.id === selectedId) : -1;
    const id = addMissionItem(action, selIndex >= 0 ? { index: selIndex + 1 } : undefined);
    if (id) {
      selectMissionItem(id);
      setInspectorTab('item');
    }
  };

  const plan = (panel: 'survey' | 'optimise' | 'avoid') => {
    setPlanOpen(false);
    if (panel === 'survey' && !surveyArea) {
      setActiveTool('draw-area');
      addToast('Outline the survey area on the map', 'info');
      return;
    }
    openPlanPanel(panel);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 px-3">
        <span className="text-[13px] text-text-secondary">
          <span className="tabular-nums text-text-primary">{mission.items.length}</span> item{mission.items.length === 1 ? '' : 's'}
        </span>
        <div className="flex-1" />
        <Dropdown isOpen={planOpen} onOpenChange={setPlanOpen}>
          <DropdownTrigger aria-label="Plan" className={cx(buttonStyles.base, buttonStyles.size.small, buttonStyles.variant.secondary, 'gap-1')}>
            <RiFlowChart className="size-4" aria-hidden />
            <span className="px-0.5">Plan</span>
            <RiArrowDownSLine className="size-4" aria-hidden />
          </DropdownTrigger>
          <DropdownPopover aria-label="Plan tools" placement="bottom end" className={cx('w-[280px]', MENU_PANEL)}>
            <DropdownItem onSelect={() => plan('survey')} className="flex-col items-start gap-0">
              <span className="text-[14px]">Survey area…</span>
              <span className="text-[12px] text-text-secondary">Lawnmower grid over a drawn polygon</span>
            </DropdownItem>
            <DropdownItem onSelect={() => plan('optimise')} className="flex-col items-start gap-0">
              <span className="text-[14px]">Optimise order…</span>
              <span className="text-[12px] text-text-secondary">Shortest visiting order, keeps takeoff and landing</span>
            </DropdownItem>
            <DropdownItem onSelect={() => plan('avoid')} className="flex-col items-start gap-0">
              <span className="text-[14px]">Route around zones…</span>
              <span className="text-[12px] text-text-secondary">Adds detours so no leg crosses a keep-out zone</span>
            </DropdownItem>
          </DropdownPopover>
        </Dropdown>
        <Dropdown isOpen={addOpen} onOpenChange={setAddOpen}>
          <DropdownTrigger aria-label="Add item" className={cx(buttonStyles.base, buttonStyles.size.small, buttonStyles.variant.secondary, 'gap-1')}>
            <RiAddLine className="size-4" aria-hidden />
            <span className="px-0.5">Add</span>
          </DropdownTrigger>
          <DropdownPopover aria-label="Add item" placement="bottom end" className={cx('w-[240px]', MENU_PANEL)}>
            <DropdownGroup label={selectedId ? 'Insert after selected' : 'Add to end'}>
              {ADD_OPTIONS.map((o) => (
                <DropdownItem key={o.action} onSelect={() => add(o.action)} className="px-2 py-1.5 text-[14px]">
                  {o.label}
                </DropdownItem>
              ))}
            </DropdownGroup>
          </DropdownPopover>
        </Dropdown>
      </div>

      {mission.items.length === 0 ? (
        <div className="flex flex-1 flex-col items-start gap-3 px-4 pb-10 pt-6">
          <p className="text-[14px] font-medium text-text-primary">No items yet</p>
          <p className="max-w-[36ch] text-[13px] text-text-secondary">Click the map with the Waypoint tool, outline a survey area, or start from a template.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="small" variant="secondary" onClick={() => setActiveTool('add-wp')}>
              Add waypoints
            </Button>
            <Button size="small" variant="secondary" onClick={() => setActiveTool('draw-area')}>
              Survey area
            </Button>
            <Button size="small" variant="secondary" onClick={() => setTemplatePickerOpen(true)}>
              Template
            </Button>
          </div>
        </div>
      ) : (
        <>
        <div aria-hidden className={cx(LABEL_MONO, 'flex h-7 shrink-0 items-center gap-2 border-y border-separator-border bg-background-secondary-default pl-[54px] pr-3')}>
          <span className="flex-1">Item</span>
          <span className="w-12 text-end">Alt</span>
          <span className="w-14 text-end">Leg</span>
          <span className="w-4" />
        </div>
        <ol aria-label="Mission items" className="min-h-0 flex-1 overflow-y-auto pb-2">
          {rows.map(({ item, index, spatial, legM }) => {
            const selected = item.id === selectedId;
            const sev = severity.get(item.id);
            return (
              <li
                key={item.id}
                draggable
                onDragStart={(e) => {
                  dragFrom.current = index;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(index);
                }}
                onDragLeave={() => setDragOver((d) => (d === index ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  setDragOver(null);
                  if (from !== null && from !== index) reorder(from, index);
                }}
                className={cx('group border-b border-separator-border/60', dragOver === index && 'ring-2 ring-inset ring-border-focus-ring')}
              >
                <button
                  type="button"
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => {
                    selectMissionItem(item.id);
                    if (spatial) focusMap({ kind: 'point', point: [item.longitude!, item.latitude!] });
                  }}
                  onDoubleClick={() => setInspectorTab('item')}
                  className={cx(ROW, FOCUS_RING_INSET, 'pl-1', selected ? ROW_SELECTED : 'hover:bg-background-primary-hover')}
                >
                  <RiDraggable className="size-3.5 shrink-0 cursor-grab text-text-tertiary opacity-0 group-hover:opacity-100" aria-hidden />
                  <ItemBadge n={index + 1} kind={spatial ? 'spatial' : 'command'} selected={selected} />
                  <span className="min-w-0 flex-1 truncate text-text-primary">
                    {COMMAND_SHORT_LABELS[item.command] ?? item.name}
                    {!supportsCoordinates(item.action) && (
                      <span className="text-text-tertiary"> {commandSummary(item.action, item.parameters)}</span>
                    )}
                  </span>
                  <span className="w-12 shrink-0 text-end text-[13px] tabular-nums text-text-secondary">
                    {item.altitude != null && supportsCoordinates(item.action) ? `${Math.round(item.altitude)} m` : ''}
                  </span>
                  <span className="w-14 shrink-0 text-end text-[13px] tabular-nums text-text-tertiary">{legM != null ? formatDistance(legM) : ''}</span>
                  <span className="flex w-4 shrink-0 justify-end">
                    {sev === 'error' && <RiErrorWarningLine className={cx('size-3.5', TONE_TEXT.danger)} aria-label="Has errors" />}
                    {sev === 'warning' && <RiAlertLine className={cx('size-3.5', TONE_TEXT.warn)} aria-label="Has warnings" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        </>
      )}

      <div className="shrink-0 border-t border-separator-border px-2 py-1.5">
        <Button size="small" variant="secondary" leadingIcon={RiTableLine} onClick={() => setParamTableOpen(true)} className="w-full justify-start border-transparent shadow-none">
          Open parameter table
        </Button>
      </div>
    </div>
  );
}

function commandSummary(action: PlannerAction, p: { param1: number; param2: number }): string {
  switch (action) {
    case PlannerAction.SET_SPEED:
      return `${p.param2} m/s`;
    case PlannerAction.WAIT:
      return `${p.param1} s`;
    case PlannerAction.CAM_TRIGG_DIST:
      return p.param1 > 0 ? `every ${p.param1} m` : 'stop';
    case PlannerAction.DO_JUMP:
      return `to item ${p.param1} · ${p.param2}×`;
    case PlannerAction.CONDITION_DISTANCE:
      return `${p.param1} m`;
    case PlannerAction.RTL:
      return 'back to home';
    default:
      return '';
  }
}
