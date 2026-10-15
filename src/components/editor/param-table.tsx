'use client';

import { useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { COMMAND_SHORT_LABELS, getMissionCommandDefinition, type MissionParameters } from '@/lib/mavlink/commands';
import { round7 } from '@/lib/utils';
import type { MissionItem } from '@/types/mission';
import { cx } from '@/utils/cx';
import { PARAM_FIELDS } from './inspector/item-tab';

type NumKey = 'latitude' | 'longitude' | 'altitude' | 'param1' | 'param2' | 'param3' | 'param4';

/** Compact cell editor: shows the value, commits on blur / Enter, reverts on Escape. */
function Cell({ value, label, disabled, onCommit }: { value: number | null; label: string; disabled?: boolean; onCommit: (v: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = value == null ? '' : String(value);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n) && n !== value) onCommit(n);
    setDraft(null);
  };
  if (disabled) return <span className="block px-2 text-text-tertiary">–</span>;
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
      className="h-8 w-full min-w-16 rounded-md border border-transparent bg-transparent px-2 font-mono text-caption-1-regular tabular-nums text-text-primary outline-none hover:border-border-button-default focus-visible:border-border-focus-ring focus-visible:ring-1 focus-visible:ring-border-focus-ring"
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
      <div className="flex h-10 shrink-0 items-center gap-2 px-4">
        <h2 className="flex-1 text-body-2-semibold text-text-primary">Parameter table</h2>
        <span className="hidden text-caption-1-regular text-text-tertiary sm:inline">Hover a parameter cell to see what it means</span>
        <Button size="small" variant="ghost" iconOnly leadingIcon={RiCloseLine} aria-label="Close parameter table" onClick={() => setParamTableOpen(false)} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-start">
          <thead className="sticky top-0 z-10 bg-background-secondary-default">
            <tr className="text-caption-1-semibold text-text-secondary">
              {['#', 'Command', 'Latitude', 'Longitude', 'Alt (m)', 'Param 1', 'Param 2', 'Param 3', 'Param 4'].map((h) => (
                <th key={h} scope="col" className="h-8 whitespace-nowrap px-2 text-start font-semibold">
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
                    item.id === selectedId ? 'bg-background-primary-hover' : 'hover:bg-background-primary-hover'
                  )}
                >
                  <td className="px-2 font-mono text-caption-1-medium tabular-nums text-text-secondary">{i + 1}</td>
                  <td className="whitespace-nowrap px-2 text-body-2-medium text-text-primary">{COMMAND_SHORT_LABELS[item.command] ?? def.label}</td>
                  <td>
                    <Cell label={`Item ${i + 1} latitude`} value={item.latitude} disabled={!def.supportsCoordinates} onCommit={(v) => set(item, 'latitude', v)} />
                  </td>
                  <td>
                    <Cell label={`Item ${i + 1} longitude`} value={item.longitude} disabled={!def.supportsCoordinates} onCommit={(v) => set(item, 'longitude', v)} />
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
        {mission.items.length === 0 && <p className="p-6 text-center text-body-2-regular text-text-secondary">No items yet.</p>}
      </div>
    </section>
  );
}
