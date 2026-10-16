'use client';

import { RiArrowDownLine, RiArrowUpLine, RiDeleteBinLine, RiFileCopyLine, RiFocus3Line } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import {
  COMMAND_SHORT_LABELS,
  FRAME_OPTIONS,
  MAVLINK_COMMAND_DEFINITIONS,
  PlannerAction,
  getMissionCommandDefinition,
  type MavlinkFrame,
  type MissionParameters,
} from '@/lib/mavlink/commands';
import { round7 } from '@/lib/utils';
import { NumberField, Section, SelectField, TextInputField } from '../fields';
import { IssueRow } from './checks-tab';
import { ItemBadge } from './waypoints-tab';
import { ICON_BUTTON } from '../editor-styles';
import { Button as AriaButton } from 'react-aria-components';

type ParamKey = 'param1' | 'param2' | 'param3' | 'param4';
interface ParamField {
  key: ParamKey;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  hint?: string;
}

/** Human labels for each command's parameters (ArduPilot semantics) instead of "P1–P4". */
export const PARAM_FIELDS: Partial<Record<PlannerAction, ParamField[]>> = {
  [PlannerAction.WAYPOINT]: [
    { key: 'param1', label: 'Hold time', unit: 's', min: 0 },
    { key: 'param2', label: 'Acceptance radius', unit: 'm', min: 0 },
    { key: 'param3', label: 'Pass radius', unit: 'm', hint: '0 = pass through the point' },
    { key: 'param4', label: 'Yaw', unit: '°', min: -360, max: 360 },
  ],
  [PlannerAction.SPLINE_WAYPOINT]: [{ key: 'param1', label: 'Hold time', unit: 's', min: 0 }],
  [PlannerAction.TAKEOFF]: [
    { key: 'param1', label: 'Minimum pitch', unit: '°', hint: 'Fixed-wing only' },
    { key: 'param4', label: 'Yaw', unit: '°', min: -360, max: 360 },
  ],
  [PlannerAction.LOITER]: [
    { key: 'param1', label: 'Loiter time', unit: 's', min: 0 },
    { key: 'param3', label: 'Radius', unit: 'm', hint: 'Negative = counter-clockwise' },
  ],
  [PlannerAction.LOITER_UNLIM]: [{ key: 'param3', label: 'Radius', unit: 'm', hint: 'Negative = counter-clockwise' }],
  [PlannerAction.LOITER_TURNS]: [
    { key: 'param1', label: 'Turns', min: 0 },
    { key: 'param3', label: 'Radius', unit: 'm', hint: 'Negative = counter-clockwise' },
  ],
  [PlannerAction.LAND]: [
    { key: 'param1', label: 'Abort altitude', unit: 'm', min: 0 },
    { key: 'param4', label: 'Yaw', unit: '°', min: -360, max: 360 },
  ],
  [PlannerAction.WAIT]: [{ key: 'param1', label: 'Delay', unit: 's', min: 0 }],
  [PlannerAction.CONDITION_DISTANCE]: [{ key: 'param1', label: 'Distance to next waypoint', unit: 'm', min: 0 }],
  [PlannerAction.SET_SPEED]: [
    { key: 'param2', label: 'Speed', unit: 'm/s', min: -1 },
    { key: 'param3', label: 'Throttle', unit: '%', min: -1, max: 100, hint: '-1 = no change' },
  ],
  [PlannerAction.CAM_TRIGG_DIST]: [
    { key: 'param1', label: 'Trigger every', unit: 'm', min: 0, hint: '0 stops triggering' },
    { key: 'param3', label: 'Trigger once now', min: 0, max: 1, hint: '1 = yes' },
  ],
  [PlannerAction.DO_JUMP]: [
    { key: 'param1', label: 'Jump to item', min: 1 },
    { key: 'param2', label: 'Repeat', unit: '×', min: -1, hint: '-1 = forever' },
  ],
  [PlannerAction.SET_ROI]: [{ key: 'param1', label: 'ROI mode', min: 0 }],
  [PlannerAction.CHANGE_ALTITUDE]: [{ key: 'param1', label: 'Action', min: 0, max: 2, hint: '0 neutral · 1 climb · 2 descend' }],
};

export const ACTION_OPTIONS = Object.values(PlannerAction).map((a) => ({
  value: a,
  label: COMMAND_SHORT_LABELS[MAVLINK_COMMAND_DEFINITIONS[a].command] ?? MAVLINK_COMMAND_DEFINITIONS[a].label,
}));

const FRAME_LABEL: Record<string, string> = { ABS: 'Above sea level', REL: 'Relative to home', TER: 'Above terrain' };

export function ItemTab() {
  const mission = useMissionStore((s) => s.mission);
  const update = useMissionStore((s) => s.updateMissionItem);
  const setAction = useMissionStore((s) => s.setMissionItemAction);
  const remove = useMissionStore((s) => s.deleteMissionItem);
  const duplicate = useMissionStore((s) => s.duplicateMissionItem);
  const reorder = useMissionStore((s) => s.reorderMissionItems);
  const selectedId = useUIStore((s) => s.selectedMissionItemId);
  const { selectMissionItem, focusMap, setInspectorTab } = useUIStore();
  const analysis = useMissionAnalysis();

  const index = mission?.items.findIndex((i) => i.id === selectedId) ?? -1;
  const item = index >= 0 ? mission!.items[index] : null;

  if (!mission || !item) {
    return (
      <div className="flex flex-col items-start gap-2 px-4 py-6">
        <p className="text-[14px] font-medium text-text-primary">Nothing selected</p>
        <p className="max-w-[36ch] text-[13px] text-text-secondary">Select a waypoint on the map or in the Waypoints list to edit it here.</p>
        <Button size="small" variant="secondary" onClick={() => setInspectorTab('waypoints')}>
          Show waypoints
        </Button>
      </div>
    );
  }

  const def = getMissionCommandDefinition(item.action);
  const fields = PARAM_FIELDS[item.action] ?? [];
  const issues = analysis?.issues.filter((i) => i.itemIds.includes(item.id)) ?? [];
  const setParam = (key: keyof MissionParameters, v: number | null) =>
    update(item.id, { parameters: { ...item.parameters, [key]: v ?? 0 } });

  return (
    <div key={item.id} className="flex flex-col gap-5 px-4 pb-6">
      <div className="flex items-center gap-2">
        <ItemBadge n={index + 1} kind={def.supportsCoordinates ? 'spatial' : 'command'} selected />
        <span className="min-w-0 flex-1 truncate text-[16px] font-medium text-text-primary">
          {COMMAND_SHORT_LABELS[item.command] ?? def.label}
        </span>
        {def.supportsCoordinates && item.latitude !== null && item.longitude !== null && (
          <AriaButton
            aria-label="Show on map"
            onPress={() => focusMap({ kind: 'point', point: [item.longitude!, item.latitude!] })}
            className={ICON_BUTTON}
          >
            <RiFocus3Line className="size-4" aria-hidden />
          </AriaButton>
        )}
      </div>

      {issues.length > 0 && (
        <ul className="-mx-4 flex flex-col" aria-label="Issues for this item">
          {issues.map((issue, i) => (
            <IssueRow key={i} issue={issue} />
          ))}
        </ul>
      )}

      <Section title="Command">
        <SelectField label="Type" value={item.action} options={ACTION_OPTIONS} onChange={(a) => setAction(item.id, a)} />
        <p className="-mt-1 text-[13px] text-text-secondary">{def.description}</p>
      </Section>

      {def.supportsCoordinates && (
        <Section title="Position">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Latitude" mono value={item.latitude} precision={7} min={-90} max={90} onCommit={(v) => v !== null && update(item.id, { latitude: round7(v) })} />
            <NumberField label="Longitude" mono value={item.longitude} precision={7} min={-180} max={180} onCommit={(v) => v !== null && update(item.id, { longitude: round7(v) })} />
          </div>
        </Section>
      )}

      {(def.supportsAltitude || def.supportsSpeed) && (
        <Section title="Flight">
          <div className="grid grid-cols-2 gap-3">
            {def.supportsAltitude && (
              <NumberField label="Altitude" unit="m" value={item.altitude} min={-500} max={10000} onCommit={(v) => v !== null && update(item.id, { altitude: v })} />
            )}
            {def.supportsSpeed && (
              <NumberField
                label="Speed"
                unit="m/s"
                value={item.speed ?? null}
                allowEmpty
                min={0}
                max={200}
                hint="Empty = mission default"
                onCommit={(v) => update(item.id, { speed: v && v > 0 ? v : undefined })}
              />
            )}
          </div>
          {def.supportsAltitude && (
            <SelectField
              label="Altitude reference"
              value={item.frame as number}
              options={FRAME_OPTIONS.map((f) => ({ value: f.value as number, label: FRAME_LABEL[f.label] ?? f.label }))}
              onChange={(v) => update(item.id, { frame: v as MavlinkFrame })}
            />
          )}
        </Section>
      )}

      {fields.length > 0 && (
        <Section title="Parameters">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                unit={f.unit}
                min={f.min}
                max={f.max}
                hint={f.hint}
                value={item.parameters[f.key]}
                onCommit={(v) => setParam(f.key, v)}
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Notes">
        <TextInputField label="Label" value={item.notes ?? ''} placeholder="Optional note" onCommit={(v) => update(item.id, { notes: v || undefined })} />
      </Section>

      <div className="flex flex-wrap gap-2 border-t border-separator-border pt-4">
        <Button size="small" variant="secondary" leadingIcon={RiArrowUpLine} disabled={index === 0} onClick={() => reorder(index, index - 1)}>
          Up
        </Button>
        <Button
          size="small"
          variant="secondary"
          leadingIcon={RiArrowDownLine}
          disabled={index === mission.items.length - 1}
          onClick={() => reorder(index, index + 1)}
        >
          Down
        </Button>
        <Button size="small" variant="secondary" leadingIcon={RiFileCopyLine} onClick={() => duplicate(item.id)}>
          Duplicate
        </Button>
        <Button
          size="small"
          variant="danger"
          leadingIcon={RiDeleteBinLine}
          onClick={() => {
            const next = mission.items[index + 1] ?? mission.items[index - 1];
            remove(item.id);
            selectMissionItem(next?.id ?? null);
          }}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
