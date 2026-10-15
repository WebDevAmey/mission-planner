'use client';

import { RiDeleteBinLine, RiFocus3Line, RiShieldLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Switch } from '@/components/base/switch/switch';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { ZONE_KIND_LABEL, type MissionZone, type ZoneKind } from '@/lib/store/editor-types';
import { zoneRing, formatDistance } from '@/components/map/map-geo';
import { cx } from '@/utils/cx';
import { NumberField, Section, SelectField, TextInputField } from '../fields';

const KIND_OPTIONS: { value: ZoneKind; label: string }[] = [
  { value: 'keep_out', label: 'Keep-out' },
  { value: 'no_fly', label: 'No-fly' },
  { value: 'keep_in', label: 'Keep-in (geofence)' },
];

function ZoneRow({ zone }: { zone: MissionZone }) {
  const updateZone = useMissionStore((s) => s.updateZone);
  const deleteZone = useMissionStore((s) => s.deleteZone);
  const selectedZoneId = useUIStore((s) => s.selectedZoneId);
  const { selectZone, focusMap, addToast } = useUIStore();
  const selected = selectedZoneId === zone.id;

  const zoomTo = () => {
    const ring = zoneRing(zone);
    if (!ring) return;
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    focusMap({ kind: 'bounds', bounds: [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] });
  };

  return (
    <li className={cx('rounded-2lg border', selected ? 'border-border-focus-ring bg-background-primary-default' : 'border-border-button-default')}>
      <div className="flex items-center gap-2 p-2">
        <button
          type="button"
          onClick={() => {
            selectZone(selected ? null : zone.id);
            if (!selected) zoomTo();
          }}
          aria-expanded={selected}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <span
            aria-hidden
            className={cx('size-3 shrink-0 rounded-sm border-2 border-dashed', zone.kind === 'keep_in' ? 'border-blue bg-blue-bg' : 'border-red bg-red-bg')}
          />
          <span className="flex min-w-0 flex-col">
            <span className={cx('truncate text-body-2-medium', zone.enabled ? 'text-text-primary' : 'text-text-tertiary line-through')}>{zone.label || 'Zone'}</span>
            <span className="text-caption-1-regular text-text-secondary">
              {ZONE_KIND_LABEL[zone.kind]} · {zone.shape === 'circle' ? `circle ${formatDistance(zone.radiusM ?? 0)}` : `${zone.vertices?.length ?? 0}-point polygon`}
            </span>
          </span>
        </button>
        <Switch
          size="sm"
          isSelected={zone.enabled}
          onChange={(v) => updateZone(zone.id, { enabled: v })}
          aria-label={`${zone.enabled ? 'Disable' : 'Enable'} ${zone.label}`}
        />
      </div>
      {selected && (
        <div className="flex flex-col gap-3 border-t border-separator-border p-3">
          <TextInputField label="Name" value={zone.label} onCommit={(v) => updateZone(zone.id, { label: v.trim() || zone.label })} />
          <SelectField label="Type" value={zone.kind} options={KIND_OPTIONS} onChange={(k) => updateZone(zone.id, { kind: k })} />
          {zone.shape === 'circle' && (
            <NumberField label="Radius" unit="m" value={zone.radiusM} min={1} max={100000} onCommit={(v) => v && updateZone(zone.id, { radiusM: v })} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Floor" unit="m" allowEmpty value={zone.minAltM ?? null} hint="Empty = ground" onCommit={(v) => updateZone(zone.id, { minAltM: v })} />
            <NumberField label="Ceiling" unit="m" allowEmpty value={zone.maxAltM ?? null} hint="Empty = unlimited" onCommit={(v) => updateZone(zone.id, { maxAltM: v })} />
          </div>
          <div className="flex gap-2">
            <Button size="small" variant="secondary" leadingIcon={RiFocus3Line} onClick={zoomTo}>
              Zoom to
            </Button>
            <Button
              size="small"
              variant="danger"
              leadingIcon={RiDeleteBinLine}
              onClick={() => {
                deleteZone(zone.id);
                selectZone(null);
                addToast(`${zone.label} deleted`, 'info', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Settings tab: mission defaults, flight limits and zones (stored per mission). */
export function SettingsTab() {
  const mission = useMissionStore((s) => s.mission);
  const updateSettings = useMissionStore((s) => s.updateSettings);
  const updateLimits = useMissionStore((s) => s.updateLimits);
  const { setActiveTool } = useUIStore();
  if (!mission) return null;
  const s = mission.settings;
  const l = mission.limits;

  return (
    <div className="flex flex-col gap-8 px-4 pb-8">
      <Section
        title={`Zones (${mission.zones.length})`}
        action={
          <Button size="xs" variant="secondary" leadingIcon={RiShieldLine} onClick={() => setActiveTool('draw-zone')}>
            Draw zone
          </Button>
        }
      >
        {mission.zones.length === 0 ? (
          <p className="text-body-2-regular text-text-secondary">
            No zones. Draw keep-out, no-fly or keep-in areas; every leg is checked against them.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mission.zones.map((z) => (
              <ZoneRow key={z.id} zone={z} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Limits">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Min altitude" unit="m" value={l.minAltM} min={0} max={10000} onCommit={(v) => v !== null && updateLimits({ minAltM: v })} />
          <NumberField label="Max altitude" unit="m" value={l.maxAltM} min={1} max={10000} onCommit={(v) => v !== null && updateLimits({ maxAltM: v })} />
          <NumberField label="Max distance" unit="m" value={l.maxDistanceM} min={1} max={1000000} onCommit={(v) => v !== null && updateLimits({ maxDistanceM: v })} />
          <NumberField label="Max speed" unit="m/s" value={l.maxSpeedMs} min={1} max={200} onCommit={(v) => v !== null && updateLimits({ maxSpeedMs: v })} />
          <NumberField
            label="Terrain clearance"
            unit="m"
            value={l.minAGLClearance}
            min={0}
            max={10000}
            hint="Minimum height above ground"
            onCommit={(v) => v !== null && updateLimits({ minAGLClearance: v })}
            className="col-span-2"
          />
        </div>
      </Section>

      <Section title="Defaults for new items">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Altitude" unit="m" value={s.defaultAltitude} min={1} max={10000} onCommit={(v) => v && updateSettings({ defaultAltitude: v })} />
          <NumberField label="Speed" unit="m/s" value={s.defaultSpeed} min={0.5} max={200} onCommit={(v) => v && updateSettings({ defaultSpeed: v })} />
          <NumberField label="Loiter time" unit="s" value={s.defaultLoiterTime} min={0} max={86400} onCommit={(v) => v !== null && updateSettings({ defaultLoiterTime: v })} />
          <NumberField label="Wait time" unit="s" value={s.defaultWaitTime} min={0} max={86400} onCommit={(v) => v !== null && updateSettings({ defaultWaitTime: v })} />
          <NumberField
            label="Rated endurance"
            unit="min"
            value={s.ratedEnduranceS != null ? Math.round(s.ratedEnduranceS / 60) : null}
            min={1}
            max={10080}
            hint="Used for the battery budget check"
            onCommit={(v) => v && updateSettings({ ratedEnduranceS: v * 60 })}
            className="col-span-2"
          />
        </div>
      </Section>
    </div>
  );
}
