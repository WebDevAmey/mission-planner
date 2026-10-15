'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { RiArrowLeftLine, RiShapeLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Switch } from '@/components/base/switch/switch';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import type { EditorMission } from '@/lib/store/editor-types';
import { PlannerAction } from '@/lib/mavlink/commands';
import { createMissionItem } from '@/lib/domain/items';
import { missionLegs } from '@/lib/domain/mission';
import { polygonArea, projectionFor, type LngLat } from '@/lib/domain/geo';
import {
  avoidZones,
  generateSurvey,
  optimiseRoute,
  remapJumps,
  routeLengthM,
  surveyToItems,
  type CameraSpec,
} from '@/lib/domain/plan';
import type { MissionItem } from '@/types/mission';
import { formatDistance } from '@/components/map/map-geo';
import { NumberField, Section, SelectField } from '../fields';

/* ------------------------------------------------------------------ helpers */

/** Route as drawn on the map: home, every located item, back home on RTL. */
function routePath(mission: Pick<EditorMission, 'homePosition' | 'items'>): LngLat[] {
  const legs = missionLegs(mission);
  if (legs.length === 0) return [];
  return [legs[0].a, ...legs.map((l) => l.b)];
}

const isTerminal = (i: MissionItem) => i.action === PlannerAction.RTL || i.action === PlannerAction.LAND;

/** Inserts generated items before the terminal RTL/LAND (or at the end), keeping DO_JUMP
 * targets; an empty mission gets a takeoff before and an RTL after. */
function insertBeforeTerminal(mission: EditorMission, generated: MissionItem[]): MissionItem[] {
  const prev = mission.items;
  if (prev.length === 0) {
    const takeoff = createMissionItem(PlannerAction.TAKEOFF, 0, mission.settings);
    const rtl = createMissionItem(PlannerAction.RTL, 0, mission.settings);
    return [takeoff, ...generated, rtl].map((it, i) => ({ ...it, sequence: i }));
  }
  const at = prev.findIndex(isTerminal);
  const next = at < 0 ? [...prev, ...generated] : [...prev.slice(0, at), ...generated, ...prev.slice(at)];
  return remapJumps(prev, next);
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-separator-border px-3 py-2">
      <span className="text-caption-1-regular text-text-secondary">{label}</span>
      <span
        className={
          tone === 'good'
            ? 'font-mono text-body-2-semibold tabular-nums text-green'
            : tone === 'bad'
              ? 'font-mono text-body-2-semibold tabular-nums text-red'
              : 'font-mono text-body-2-semibold tabular-nums text-text-primary'
        }
      >
        {value}
      </span>
    </div>
  );
}

function PanelFrame({
  title,
  description,
  children,
  applyLabel,
  canApply,
  onApply,
}: {
  title: string;
  description: string;
  children: ReactNode;
  applyLabel: string;
  canApply: boolean;
  onApply: () => void;
}) {
  const openPlanPanel = useUIStore((s) => s.openPlanPanel);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-2 pb-2">
        <Button size="small" variant="ghost" iconOnly leadingIcon={RiArrowLeftLine} aria-label="Back to waypoints" onClick={() => openPlanPanel(null)} />
        <h2 className="text-headline-semibold text-text-primary">{title}</h2>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-4">
        <p className="text-body-2-regular text-text-secondary">{description}</p>
        {children}
      </div>
      <div className="flex justify-end gap-2 border-t border-separator-border px-4 py-3">
        <Button size="small" variant="secondary" onClick={() => openPlanPanel(null)}>
          Cancel
        </Button>
        <Button size="small" variant="primary" disabled={!canApply} onClick={onApply}>
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}

/** Keeps the map preview in sync while a planner is open; clears it on close. */
function usePreview(path: LngLat[] | null, lines?: [LngLat, LngLat][]) {
  const setPreview = useUIStore((s) => s.setPreview);
  useEffect(() => {
    setPreview(path && path.length >= 2 ? { path, lines } : null);
  }, [path, lines, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);
}

/* ------------------------------------------------------------------ survey */

const CAMERAS: { value: string; label: string; spec: CameraSpec | null }[] = [
  { value: 'none', label: 'No camera: set line spacing', spec: null },
  { value: '1in-20mp', label: '1-inch 20 MP, 8.8 mm', spec: { sensorWidthMm: 13.2, sensorHeightMm: 8.8, focalLengthMm: 8.8 } },
  { value: '43-20mp', label: '4/3 20 MP, 12.3 mm', spec: { sensorWidthMm: 17.3, sensorHeightMm: 13, focalLengthMm: 12.3 } },
  { value: 'apsc-24', label: 'APS-C, 24 mm', spec: { sensorWidthMm: 23.5, sensorHeightMm: 15.6, focalLengthMm: 24 } },
];

function SurveyPanel({ mission }: { mission: EditorMission }) {
  const area = useUIStore((s) => s.surveyArea);
  const { setActiveTool, openPlanPanel, setSurveyArea, addToast } = useUIStore();
  const replaceItems = useMissionStore((s) => s.replaceItems);
  const [altitudeM, setAltitude] = useState(mission.settings.defaultAltitude || 60);
  const [camera, setCamera] = useState('none');
  const [spacingM, setSpacing] = useState(30);
  const [sideOverlap, setSide] = useState(70);
  const [frontOverlap, setFront] = useState(80);
  const [autoAngle, setAutoAngle] = useState(true);
  const [angleDeg, setAngle] = useState(0);
  const [turnaroundM, setTurnaround] = useState(mission.settings.turnaroundM ?? 10);

  const cam = CAMERAS.find((c) => c.value === camera)?.spec ?? null;

  const result = useMemo(() => {
    if (!area || area.length < 3) return null;
    try {
      const survey = generateSurvey({
        polygon: area,
        altitudeM,
        ...(cam ? { camera: cam, sideOverlap: sideOverlap / 100, frontOverlap: frontOverlap / 100 } : { spacingM }),
        ...(autoAngle ? {} : { angleDeg }),
        turnaroundM,
      });
      const proj = projectionFor(area);
      const areaM2 = polygonArea(area.map(proj.toLocal));
      return { survey, areaM2, error: null as string | null };
    } catch (err) {
      return { survey: null, areaM2: 0, error: err instanceof Error ? err.message : 'Could not plan this area' };
    }
  }, [area, altitudeM, cam, spacingM, sideOverlap, frontOverlap, autoAngle, angleDeg, turnaroundM]);

  usePreview(result?.survey?.path ?? null, result?.survey?.lines);

  if (!area) {
    return (
      <PanelFrame title="Survey area" description="Outline the area to cover on the map, then set altitude and spacing." applyLabel="Add survey" canApply={false} onApply={() => {}}>
        <Button size="small" variant="primary" leadingIcon={RiShapeLine} onClick={() => setActiveTool('draw-area')}>
          Draw area on map
        </Button>
      </PanelFrame>
    );
  }

  const apply = () => {
    if (!result?.survey) return;
    const generated = surveyToItems(result.survey, mission.settings, { altitudeM, triggerCamera: !!cam });
    replaceItems(insertBeforeTerminal(mission, generated), 'Add survey');
    addToast(`Added ${result.survey.lineCount}-line survey`, 'success', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
    setSurveyArea(null);
    openPlanPanel(null);
  };

  const s = result?.survey;
  return (
    <PanelFrame
      title="Survey area"
      description="Lawnmower passes over the drawn area. Waypoints are added before the final return or landing."
      applyLabel="Add survey"
      canApply={!!s && s.lineCount > 0}
      onApply={apply}
    >
      <Section title="Pattern">
        <NumberField label="Altitude" unit="m" value={altitudeM} min={1} max={1000} onCommit={(v) => v && setAltitude(v)} />
        <SelectField label="Camera" value={camera} options={CAMERAS.map(({ value, label }) => ({ value, label }))} onChange={setCamera} />
        {cam ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Side overlap" unit="%" value={sideOverlap} min={0} max={95} onCommit={(v) => v !== null && setSide(v)} />
            <NumberField label="Front overlap" unit="%" value={frontOverlap} min={0} max={95} onCommit={(v) => v !== null && setFront(v)} />
          </div>
        ) : (
          <NumberField label="Line spacing" unit="m" value={spacingM} min={1} max={5000} onCommit={(v) => v && setSpacing(v)} />
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-2-medium text-text-primary">Best line direction</span>
          <Switch size="sm" isSelected={autoAngle} onChange={setAutoAngle} aria-label="Choose line direction automatically" />
        </div>
        {!autoAngle && (
          <NumberField label="Line bearing" unit="°" value={angleDeg} min={0} max={180} onCommit={(v) => v !== null && setAngle(v)} />
        )}
        <NumberField label="Turnaround" unit="m" value={turnaroundM} min={0} max={500} hint="Extends each pass past the edge" onCommit={(v) => v !== null && setTurnaround(v)} />
      </Section>
      <Section title="Preview">
        {result?.error ? (
          <p className="text-body-2-regular text-red">{result.error}</p>
        ) : s ? (
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Passes" value={s.lineCount} />
            <Stat label="Flight path" value={formatDistance(s.lengthM)} />
            <Stat label="Spacing" value={`${s.spacingM.toFixed(1)} m`} />
            <Stat label="Area" value={result!.areaM2 > 1e5 ? `${(result!.areaM2 / 1e4).toFixed(1)} ha` : `${Math.round(result!.areaM2)} m²`} />
            {s.triggerDistanceM != null && <Stat label="Photo every" value={`${s.triggerDistanceM.toFixed(1)} m`} />}
            <Stat label="Line bearing" value={`${Math.round(s.angleDeg)}°`} />
          </div>
        ) : null}
        <Button size="small" variant="ghost" leadingIcon={RiShapeLine} onClick={() => setActiveTool('draw-area')}>
          Redraw area
        </Button>
      </Section>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------ optimise */

function OptimisePanel({ mission }: { mission: EditorMission }) {
  const replaceItems = useMissionStore((s) => s.replaceItems);
  const selectedId = useUIStore((s) => s.selectedMissionItemId);
  const { openPlanPanel, addToast } = useUIStore();
  const [lockSelected, setLockSelected] = useState(false);

  const result = useMemo(
    () => optimiseRoute(mission, { lockedIds: lockSelected && selectedId ? [selectedId] : [] }),
    [mission, lockSelected, selectedId]
  );
  const path = useMemo(() => routePath({ homePosition: mission.homePosition, items: result.items }), [mission.homePosition, result.items]);
  usePreview(result.changed ? path : null);

  const apply = () => {
    replaceItems(result.items, 'Optimise order');
    addToast(`Route shortened by ${formatDistance(result.savedM)}`, 'success', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
    openPlanPanel(null);
  };

  return (
    <PanelFrame
      title="Optimise order"
      description="Reorders waypoints between takeoff and the final return or landing for the shortest route. Commands stay with the waypoint they precede."
      applyLabel="Apply new order"
      canApply={result.changed && result.savedM > 0.5}
      onApply={apply}
    >
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Current" value={formatDistance(result.originalM)} />
        <Stat label="Optimised" value={formatDistance(result.optimisedM)} tone={result.savedM > 0.5 ? 'good' : undefined} />
        <Stat label="Saved" value={result.savedM > 0.5 ? `${formatDistance(result.savedM)} (${Math.round(result.savedFraction * 100)}%)` : 'Already optimal'} />
      </div>
      {selectedId && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-body-2-medium text-text-primary">Keep the selected item in place</span>
          <Switch size="sm" isSelected={lockSelected} onChange={setLockSelected} aria-label="Keep the selected item in place" />
        </div>
      )}
      <p className="text-caption-1-regular text-text-tertiary">The dashed line on the map shows the new route.</p>
    </PanelFrame>
  );
}

/* ------------------------------------------------------------------ avoid */

function AvoidPanel({ mission }: { mission: EditorMission }) {
  const replaceItems = useMissionStore((s) => s.replaceItems);
  const { openPlanPanel, addToast, selectMissionItem } = useUIStore();
  const [marginM, setMargin] = useState(20);
  const zones = useMemo(() => mission.zones.filter((z) => z.enabled), [mission.zones]);

  const result = useMemo(() => avoidZones(mission, zones, { marginM }), [mission, zones, marginM]);
  const path = useMemo(() => routePath({ homePosition: mission.homePosition, items: result.items }), [mission.homePosition, result.items]);
  usePreview(result.changed ? path : null);
  const before = useMemo(() => routeLengthM(mission), [mission]);

  const apply = () => {
    replaceItems(result.items, 'Route around zones');
    addToast(`Added ${result.insertedIds.length} detour point${result.insertedIds.length === 1 ? '' : 's'}`, 'success', {
      label: 'Undo',
      onClick: () => useMissionStore.getState().undo(),
    });
    openPlanPanel(null);
  };

  return (
    <PanelFrame
      title="Route around zones"
      description="Adds detour waypoints so no leg crosses a keep-out or no-fly zone, or leaves a keep-in zone."
      applyLabel="Add detours"
      canApply={result.changed}
      onApply={apply}
    >
      {zones.length === 0 ? (
        <p className="text-body-2-regular text-text-secondary">This mission has no enabled zones. Draw one with the Zone tool (Z).</p>
      ) : (
        <>
          <NumberField label="Safety margin" unit="m" value={marginM} min={0} max={1000} onCommit={(v) => v !== null && setMargin(v)} />
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Detour points" value={result.insertedIds.length} />
            <Stat label="Added distance" value={formatDistance(result.addedM)} />
            <Stat label="Route now" value={formatDistance(before)} />
            <Stat label="Unresolved legs" value={result.unresolved.length} tone={result.unresolved.length ? 'bad' : undefined} />
          </div>
          {!result.changed && result.unresolved.length === 0 && (
            <p className="text-body-2-regular text-text-secondary">No leg crosses a zone. Nothing to change.</p>
          )}
          {result.unresolved.length > 0 && (
            <ul className="flex flex-col gap-1">
              {result.unresolved.map((u, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => u.itemIds[0] && selectMissionItem(u.itemIds[u.itemIds.length - 1])}
                    className="text-start text-body-2-regular text-red underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                  >
                    {u.reason === 'endpoint_in_zone' ? 'A waypoint sits inside a zone: move it first.' : 'No way around was found for one leg.'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PanelFrame>
  );
}

/** Hosts the active planner (survey / optimise / avoid) inside the Waypoints tab.
 * Each previews on the map and applies as a single undo step. */
export function PlanPanelHost() {
  const panel = useUIStore((s) => s.planPanel);
  const mission = useMissionStore((s) => s.mission);
  if (!panel || !mission) return null;
  if (panel === 'survey') return <SurveyPanel mission={mission} />;
  if (panel === 'optimise') return <OptimisePanel mission={mission} />;
  return <AvoidPanel mission={mission} />;
}
