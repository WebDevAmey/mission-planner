'use client';

import { useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { COMMAND_SHORT_LABELS, getMissionCommandDefinition, type MissionParameters } from '@/lib/mavlink/commands';
import { round7 } from '@/lib/utils';
import type { MissionItem } from '@/types/mission';
import { cx } from '@/utils/cx';
import { PARAM_FIELDS } from './inspector/item-tab';
import { LABEL_MONO, ROW_SELECTED } from './editor-styles';
import { QuietButton } from '@/components/editor/quiet-button';

type NumKey = 'latitude' | 'longitude' | 'altitude' | 'param1' | 'param2' | 'param3' | 'param4';

/** Compact cell editor: shows the value, commits on blur / Enter, reverts on Escape. */
function Cell({ value, label, disabled, mono, onCommit }: { value: number | null; label: string; disabled?: boolean; mono?: boolean; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value == null ? '' : String(value);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(n);
    setDraft(null);
  };
  if (disabled) return <span className="block px-2 text-[13px] text-text-tertiary">–</span>;
  return (
    <input
      aria-label={label}
      title={label}
      inputMode="decimal"
      value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className={cx(
        'h-7 w-full min-w-16 rounded-[4px] border border-transparent bg-transparent px-2 text-[13px] tabular-nums text-text-primary outline-none hover:border-separator-border focus-visible:border-border-focus-ring focus-visible:ring-1 focus-visible:ring-border-focus-ring',
        mono && 'font-mono'
      )}
    />
  );
}

/** Optional bottom drawer: every item's raw values in one grid (power users). */
export function ParamTable() {
  const mission = useMissionStore((s) => s.mission);
  const update = useMissionStore((s) => s.updateMissionItem);
  const selectedId = useUIStore((s) => s.selectedMissionItemId);
  const selectMissionItem = useUIStore((s) => s.selectMissionItem);
  const setParamTableOpen = useUIStore((s) => s.setParamTableOpen);
  if (!mission) return null;

  const set = (item: MissionItem, key: NumKey, v: number) => {
    if (key === 'latitude' || key === 'longitude') update(item.id, { [key]: round7(v) });
    else if (key === 'altitude') update(item.id, { altitude: v });
    else update(item.id, { parameters: { ...item.parameters, [key]: v } as MissionParameters });
  };

  return (
    <section aria-label="Parameter table" className="flex h-64 shrink-0 flex-col border-t border-separator-border bg-background-primary-default">
      <div className="flex h-10 shrink-0 items-center gap-2 pl-4 pr-2">
        <h2 className="flex-1 text-[13px] font-medium text-text-primary">Parameter table</h2>
        <span className="hidden text-[12px] text-text-tertiary sm:inline">Hover a parameter cell to see what it means</span>
        <QuietButton iconOnly icon={RiCloseLine} aria-label="Close parameter table" onPress={() => setParamTableOpen(false)} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-start">
          <thead className="sticky top-0 z-10 bg-background-secondary-default">
            <tr>
              {['#', 'Command', 'Latitude', 'Longitude', 'Alt (m)', 'Param 1', 'Param 2', 'Param 3', 'Param 4'].map((h) => (
                <th key={h} scope="col" className={cx(LABEL_MONO, 'h-7 whitespace-nowrap px-2 text-start')}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mission.items.map((item, i) => {
              const def = getMissionCommandDefinition(item.action);
              const fields = PARAM_FIELDS[item.action] ?? [];
              const labelOf = (k: 'param1' | 'param2' | 'param3' | 'param4') => fields.find((f) => f.key === k);
              return (
                <tr
                  key={item.id}
                  onClick={() => selectMissionItem(item.id)}
                  className={cx(
                    'border-t border-separator-border',
                    item.id === selectedId ? ROW_SELECTED : 'hover:bg-background-primary-hover'
                  )}
                >
                  <td className="px-2 text-[13px] tabular-nums text-text-tertiary">{i + 1}</td>
                  <td className="whitespace-nowrap px-2 text-[13px] text-text-primary">{COMMAND_SHORT_LABELS[item.command] ?? def.label}</td>
                  <td>
                    <Cell mono label={`Item ${i + 1} latitude`} value={item.latitude} disabled={!def.supportsCoordinates} onCommit={(v) => set(item, 'latitude', v)} />
                  </td>
                  <td>
                    <Cell mono label={`Item ${i + 1} longitude`} value={item.longitude} disabled={!def.supportsCoordinates} onCommit={(v) => set(item, 'longitude', v)} />
                  </td>
                  <td>
                    <Cell label={`Item ${i + 1} altitude`} value={item.altitude} disabled={!def.supportsAltitude} onCommit={(v) => set(item, 'altitude', v)} />
                  </td>
                  {(['param1', 'param2', 'param3', 'param4'] as const).map((k) => {
                    const f = labelOf(k);
                    return (
                      <td key={k}>
                        <Cell
                          label={f ? `Item ${i + 1} ${f.label}${f.unit ? ` (${f.unit})` : ''}` : `Item ${i + 1} ${k} (unused)`}
                          value={item.parameters[k]}
                          disabled={!f}
                          onCommit={(v) => set(item, k, v)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {mission.items.length === 0 && <p className="p-6 text-[13px] text-text-secondary">No items yet.</p>}
      </div>
    </section>
  );
}
