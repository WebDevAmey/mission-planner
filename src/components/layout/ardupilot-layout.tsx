'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Download, Undo2, Redo2, Wand2, AlertTriangle,
  Clock, Grid3X3, Bot, LogOut, Route, X,
} from 'lucide-react';
import { useMissionStore } from '@/lib/store/mission-store';
import { signOut } from '@/lib/store/local-data';
import { useSaveStore } from '@/lib/store/save-store';
import { SaveIndicator } from '@/components/editor/save-indicator';
import { useUIStore } from '@/lib/store/ui-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { MapView } from '@/components/map/map-view';
import { MapToolbar } from '@/components/flight-plan/map-toolbar';
import { WaypointTable } from '@/components/flight-plan/waypoint-table';
import { ConstraintsPanel } from '@/components/constraints/constraints-panel';
import { MissionSummary } from '@/components/mission/mission-summary';
import { ToastContainer } from '@/components/common/toast';
import { TemplatePicker } from '@/components/mission/template-picker';
import { TerrainPanel } from '@/components/mission/terrain-panel';
import { TimelinePanel } from '@/components/mission/timeline-panel';
import { MissionPromptBar } from '@/components/agent-console/mission-prompt-bar';
import { AgentConsole } from '@/components/agent-console/agent-console';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { useMissionPlannerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { missionSanityCheck, exportMissionAsV1Json, makeExportFilename } from '@/lib/services/mission-builder';
import { optimiseRoute, generateAlternativeRoutes } from '@/lib/services/route-optimizer';
import { computeRiskScore } from '@/lib/services/risk-scorer';
import { computeMissionMetrics } from '@/lib/services/metrics-service';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import { cn } from '@/lib/utils';

// Risk gauge SVG
function RiskGauge({ score, level }: { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const color = level === 'LOW' ? '#00ff41' : level === 'MEDIUM' ? '#ffaa00' : '#ff3333';
  const r = 12;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;

  return (
    <div title={`Risk Score: ${score.toFixed(0)}/100 — ${level}`} className="flex cursor-default items-center gap-1">
      <svg width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={r} fill="none" stroke="var(--color-border-mid)" strokeWidth="3" />
        <circle
          cx="16" cy="16" r={r} fill="none" stroke={color} strokeWidth="3"
          strokeDasharray={`${progress} ${circ - progress}`}
          strokeLinecap="round"
          transform="rotate(-90 16 16)"
          style={{ transition: 'stroke-dasharray 500ms ease' }}
        />
        <text x="16" y="20" textAnchor="middle" fill={color}
          style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 700 }}>
          {score.toFixed(0)}
        </text>
      </svg>
      <span className="font-mono text-[9px]" style={{ color }}>
        {level}
      </span>
    </div>
  );
}

type ToolbarButtonVariant = 'ghost' | 'default' | 'accent';

/** One button shape for the whole top bar — every toggle, action, and icon button
 * in TopBar renders through this so hover/active/disabled styling only lives once. */
function ToolbarButton({
  icon: Icon,
  iconSize = 12,
  iconColor,
  label,
  onClick,
  active,
  disabled,
  title,
  ariaLabel,
  variant = 'default',
  hoverRed,
}: {
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  iconSize?: number;
  iconColor?: string;
  label?: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  variant?: ToolbarButtonVariant;
  /** Switch to the destructive red on hover — used by the Logout button. */
  hoverRed?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-6 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border font-mono text-[10px] transition-colors duration-150',
        label ? 'px-2' : 'w-6 px-0',
        disabled && 'cursor-not-allowed border-transparent text-text-muted',
        !disabled && variant === 'default' && (
          active
            ? 'border-border-hi bg-bg-raised text-text'
            : 'border-border-mid text-text-dim hover:bg-bg-raised hover:text-text'
        ),
        !disabled && variant === 'ghost' && (
          hoverRed
            ? 'border-transparent text-text-dim hover:bg-bg-raised hover:text-red'
            : 'border-transparent text-text-dim hover:bg-bg-raised hover:text-text'
        ),
        !disabled && variant === 'accent' && 'border-green bg-green-bg font-bold tracking-[0.3px] text-green hover:bg-green/20'
      )}
    >
      {Icon && <Icon size={iconSize} color={iconColor} />}
      {label}
    </button>
  );
}

/** Vertical rule between toolbar groups. */
function ToolbarDivider() {
  return <Separator orientation="vertical" className="mx-0.5 h-[18px]" />;
}

function TopBar() {
  const {
    mission,
    updateMissionName,
    undo,
    redo,
    canUndo,
    canRedo,
    replaceItems,
  } = useMissionStore();
  const {
    addToast,
    setAlternativeRoutes,
    clearAlternativeRoutes,
    alternativeRoutes,
    toggleTemplatePicker,
    toggleTimeline,
    timelineOpen,
    templatePickerOpen,
  } = useUIStore();
  const { config, nfzs } = useConstraintsStore();
  const { geofences } = useGeofenceStore();
  const { consoleOpen, toggleConsole, status: flightDeckStatus } = useAgentStore();

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [exportConfirm, setExportConfirm] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const warnings = useMemo(() => mission ? missionSanityCheck(mission) : [], [mission]);
  const missionKey = mission?.updatedAt ?? '';
  const prevMissionKeyRef = useRef(missionKey);
  if (prevMissionKeyRef.current !== missionKey) {
    prevMissionKeyRef.current = missionKey;
    if (warningsDismissed) setWarningsDismissed(false);
  }

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  const doExport = useCallback(() => {
    if (!mission) { addToast('No mission loaded', 'error'); return; }
    if (mission.items.length === 0) { addToast('⚠ Export blocked — empty mission', 'error'); return; }

    const metrics = computeMissionMetrics(mission.items, config, nfzs, mission.homePosition);
    const content = exportMissionAsV1Json(mission, {
      tenantId: 'personal',
      tenantName: 'Personal',
      constraints: { ...config, nfzs },
      metrics,
      geofences,
    });
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = makeExportFilename(mission.name);
    a.click();
    URL.revokeObjectURL(url);
    addToast(`✓ Exported ${makeExportFilename(mission.name)}`, 'success');
    setExportConfirm(false);
    setExportOpen(false);
  }, [mission, config, nfzs, geofences, addToast]);

  const handleExportClick = useCallback(() => {
    if (!mission) { addToast('No mission loaded', 'error'); return; }
    if (mission.items.length === 0) { addToast('⚠ Export blocked — empty mission', 'error'); return; }
    const w = missionSanityCheck(mission);
    if (w.length > 0) {
      setExportConfirm(true);
    } else {
      doExport();
    }
  }, [mission, doExport, addToast]);

  const handleOptimise = useCallback(() => {
    if (!mission || mission.items.length === 0) { addToast('No mission to optimise', 'error'); return; }
    const result = optimiseRoute(mission.items);
    if (result.alreadyOptimal) { addToast('Route already optimal', 'info'); return; }
    replaceItems(result.reorderedItems, 'Optimise order');
    addToast(`Route optimised — saved ${Math.round(result.savedM)} m`, 'success');
  }, [mission, addToast, replaceItems]);

  const handleAlternatives = useCallback(() => {
    if (!mission || mission.items.length < 4) { addToast('Need ≥4 spatial waypoints for alternatives', 'warning'); return; }
    if (alternativeRoutes.length > 0) { clearAlternativeRoutes(); return; }
    const routes = generateAlternativeRoutes(mission.items, nfzs, mission.settings.defaultSpeed);
    const withRisk = routes.map((r, i) => {
      const risk = computeRiskScore(r.orderedItems, config, nfzs);
      return {
        id: `alt-${i}`, label: r.label, color: r.color,
        itemIds: r.orderedItems.map((item) => item.id),
        distanceM: r.distanceM, timeS: r.timeS, riskScore: risk.total,
      };
    });
    setAlternativeRoutes(withRisk);
    addToast('Alternative routes computed', 'info');
  }, [mission, nfzs, config, alternativeRoutes, setAlternativeRoutes, clearAlternativeRoutes, addToast]);

  const commitName = () => { updateMissionName(nameValue); setEditingName(false); };

  const riskBreakdown = mission && mission.items.length > 0
    ? computeRiskScore(mission.items, config, nfzs) : null;

  const spatialCount = mission
    ? mission.items.filter((i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null).length
    : 0;

  return (
    <div className="flex shrink-0 flex-col border-b border-border-mid bg-[#050505]">
      {/* Warnings banner */}
      {warnings.length > 0 && !warningsDismissed && (
        <div className="flex items-center gap-2 border-b border-amber/30 bg-amber-bg px-3 py-0.5">
          <AlertTriangle size={12} className="text-amber" />
          <span className="flex-1 font-mono text-[10px] text-amber">
            {warnings[0].message}{warnings.length > 1 && ` (+${warnings.length - 1} more)`}
          </span>
          <button
            onClick={() => setWarningsDismissed(true)}
            aria-label="Dismiss warning"
            className="px-1 text-text-muted transition-colors hover:text-text"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Main row, grouped left→right: brand+context, command, edit history, route tools, panels, status/export/account */}
      <div className="flex h-[38px] items-center gap-1 border-b border-border px-2">
        {/* Brand */}
        <div className="mr-2 flex shrink-0 items-center gap-1.5">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3" fill="#00ff41" />
            <circle cx="3" cy="3" r="2" stroke="#00ff41" strokeWidth="1.5" fill="none" />
            <circle cx="17" cy="3" r="2" stroke="#00ff41" strokeWidth="1.5" fill="none" />
            <circle cx="3" cy="17" r="2" stroke="#00ff41" strokeWidth="1.5" fill="none" />
            <circle cx="17" cy="17" r="2" stroke="#00ff41" strokeWidth="1.5" fill="none" />
            <line x1="5" y1="5" x2="8" y2="8" stroke="#00ff41" strokeWidth="1" />
            <line x1="15" y1="5" x2="12" y2="8" stroke="#00ff41" strokeWidth="1" />
            <line x1="5" y1="15" x2="8" y2="12" stroke="#00ff41" strokeWidth="1" />
            <line x1="15" y1="15" x2="12" y2="12" stroke="#00ff41" strokeWidth="1" />
          </svg>
          <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-green">MPS</span>
        </div>

        <ToolbarButton label="◀ Missions" variant="ghost" title="Back to missions"
          onClick={async () => { await useSaveStore.getState().flush(); window.location.href = '/dashboard'; }} />
        <ToolbarDivider />
        {mission && (editingName ? (
          <input type="text" value={nameValue} onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
            autoFocus
            className="w-40 rounded-sm border border-green bg-bg-raised px-1.5 py-0.5 font-mono text-xs text-text outline-none"
          />
        ) : (
          <button onClick={() => { setNameValue(mission.name); setEditingName(true); }}
            title="Click to rename"
            className="rounded-sm px-1.5 py-0.5 font-mono text-xs font-medium text-text transition-colors hover:bg-bg-raised"
          >
            {mission.name}
          </button>
        ))}

        <SaveIndicator className="ml-2" />
        <ToolbarDivider />

        {/* Command: ask Flight Deck to plan */}
        <MissionPromptBar />

        <div className="flex-1" />

        {/* Edit history */}
        <div className="flex gap-0.5">
          <ToolbarButton icon={Undo2} iconSize={13} variant="ghost" title="Undo (Ctrl+Z)"
            disabled={!canUndo()} onClick={() => { undo(); addToast('Undo', 'info'); }} />
          <ToolbarButton icon={Redo2} iconSize={13} variant="ghost" title="Redo (Ctrl+Y)"
            disabled={!canRedo()} onClick={() => { redo(); addToast('Redo', 'info'); }} />
        </div>

        <ToolbarDivider />

        {/* Route tools */}
        <div className="flex gap-1">
          <ToolbarButton icon={Wand2} label="Optimise" title="Optimise route" onClick={handleOptimise} />
          {spatialCount >= 4 && (
            <ToolbarButton icon={Route} label="Alternatives" title="Alternative routes"
              active={alternativeRoutes.length > 0} onClick={handleAlternatives} />
          )}
        </div>

        <ToolbarDivider />

        {/* Panels */}
        <div className="flex gap-1">
          <ToolbarButton icon={Grid3X3} label="Templates" title="Mission templates (T)"
            active={templatePickerOpen} onClick={toggleTemplatePicker} />
          <ToolbarButton icon={Clock} label="Timeline" title="Timeline (Ctrl+T)" ariaLabel="Toggle timeline"
            active={timelineOpen} onClick={toggleTimeline} />
          <ToolbarButton icon={Bot} label="Flight Deck" title="Flight Deck agent console"
            iconColor={flightDeckStatus === 'running' ? 'var(--color-cyan)' : undefined}
            active={consoleOpen} onClick={toggleConsole} />
        </div>

        <ToolbarDivider />

        {/* Status */}
        {riskBreakdown && (
          <div className="mr-1">
            <RiskGauge score={riskBreakdown.total} level={riskBreakdown.level} />
          </div>
        )}

        {/* Export */}
        <div ref={exportRef} className="relative">
          <ToolbarButton icon={Download} label="EXPORT JSON" variant="accent" title="Export mission JSON (Ctrl+S)"
            onClick={() => setExportOpen((v) => !v)} />

          {exportOpen && (
            <div className="absolute right-0 top-full z-[9999] mt-0.5 min-w-[200px] overflow-hidden rounded-md border border-border-mid bg-bg-raised shadow-2xl">
              <button onClick={handleExportClick}
                className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-bg-hover">
                <span className="font-mono text-[11px] font-semibold text-green">
                  Mission JSON (.json)
                </span>
                <span className="font-mono text-[9px] text-text-muted">
                  MPS v1 format — complete structure
                </span>
              </button>
            </div>
          )}
        </div>

        <ToolbarDivider />

        {/* Account */}
        <ToolbarButton icon={LogOut} title="Sign out" variant="ghost" hoverRed
          onClick={async () => { await useSaveStore.getState().flush(); await signOut('/'); }} />
      </div>

      {/* Tabs */}
      <div className="flex items-stretch pl-1" style={{ height: '32px' }}>
        <button className="flex items-center whitespace-nowrap border-t border-border-mid border-b-2 border-b-green bg-bg-base px-4 font-sans text-xs font-semibold text-text">
          Flight Plan
        </button>
      </div>

      {/* Export sanity confirm modal */}
      <Dialog open={exportConfirm} onClose={() => setExportConfirm(false)} size="sm" className="border-amber/40">
        <DialogHeader onClose={() => setExportConfirm(false)}>
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber" />
            <DialogTitle>Mission has warnings</DialogTitle>
          </div>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col gap-1">
            {warnings.slice(0, 4).map((w, i) => (
              <div key={i} className="font-mono text-[10px] text-amber">• {w.message}</div>
            ))}
            {warnings.length > 4 && (
              <div className="font-mono text-[10px] text-text-muted">+{warnings.length - 4} more</div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setExportConfirm(false)}>Cancel</Button>
          <Button
            size="sm"
            onClick={doExport}
            className="border-amber bg-amber-bg font-mono font-bold text-amber hover:bg-amber/20"
          >
            Export Anyway
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}

function ResizeDivider({ onResize }: { onResize: (delta: number) => void }) {
  const dragging = useRef(false);
  const lastY = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastY.current = e.clientY;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      onResize(lastY.current - ev.clientY);
      lastY.current = ev.clientY;
    };
    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      className="h-[5px] shrink-0 cursor-row-resize bg-border-mid transition-colors duration-100 hover:bg-green-dim"
      title="Drag to resize table"
    />
  );
}

function AlternativesPanel() {
  const { alternativeRoutes, clearAlternativeRoutes, addToast } = useUIStore();
  const { replaceItems, mission } = useMissionStore();

  if (alternativeRoutes.length === 0) return null;

  const applyRoute = (route: typeof alternativeRoutes[0]) => {
    if (!mission) return;
    const byId = new Map(mission.items.map((i) => [i.id, i]));
    const ordered = route.itemIds.map((id) => byId.get(id)).filter((i): i is NonNullable<typeof i> => !!i);
    const rest = mission.items.filter((i) => !route.itemIds.includes(i.id));
    replaceItems([...ordered, ...rest], `Apply ${route.label}`);
    clearAlternativeRoutes();
    addToast(`Applied ${route.label}`, 'success');
  };

  return (
    <div className="fixed bottom-[260px] right-4 z-[1000] min-w-[240px] rounded-md border border-border-mid bg-bg-raised p-2.5 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-text">Alternative Routes</span>
        <button onClick={clearAlternativeRoutes} aria-label="Close alternative routes" className="text-text-muted hover:text-text">
          <X size={11} />
        </button>
      </div>
      {alternativeRoutes.map((route) => (
        <div
          key={route.id}
          className="mb-2 rounded-sm p-2"
          style={{ border: `1px solid ${route.color}22`, backgroundColor: `${route.color}11` }}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold" style={{ color: route.color }}>{route.label}</span>
            <button
              onClick={() => applyRoute(route)}
              className="rounded-sm px-2 py-0.5 font-mono text-[9px]"
              style={{ backgroundColor: `${route.color}22`, border: `1px solid ${route.color}`, color: route.color }}
            >
              Use this
            </button>
          </div>
          <div className="font-mono text-[9px] text-text-muted">
            {route.distanceM >= 1000 ? `${(route.distanceM / 1000).toFixed(2)} km` : `${Math.round(route.distanceM)} m`}
            {' · '}{Math.round(route.timeS)}s{' · '}Risk: {route.riskScore.toFixed(0)}
          </div>
        </div>
      ))}
    </div>
  );
}

function FlightPlanView({ tableHeight, onTableResize }: { tableHeight: number; onTableResize: (delta: number) => void }) {
  const { timelineOpen, terrainPanelOpen } = useUIStore();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {timelineOpen && <TimelinePanel />}
      <div className="flex flex-1 overflow-hidden">
        <MapToolbar />
        <MapView />
        <ConstraintsPanel />
      </div>
      <MissionSummary />
      {terrainPanelOpen && <TerrainPanel />}
      <ResizeDivider onResize={onTableResize} />
      <WaypointTable height={tableHeight} />
    </div>
  );
}

function KeyboardShortcutsMount() {
  useMissionPlannerShortcuts();
  return null;
}

export function ArduPilotLayout() {
  const [tableHeight, setTableHeight] = useState(224);
  const { templatePickerOpen } = useUIStore();

  const handleTableResize = useCallback((delta: number) => {
    setTableHeight((prev) => {
      const next = prev + delta;
      return Math.max(120, Math.min(window.innerHeight * 0.6, next));
    });
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-bg-base text-text">
      <KeyboardShortcutsMount />
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <FlightPlanView tableHeight={tableHeight} onTableResize={handleTableResize} />
      </div>
      <AlternativesPanel />
      <ToastContainer />
      <AgentConsole />
      {templatePickerOpen && <TemplatePicker />}
    </div>
  );
}
