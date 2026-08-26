'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  Download, Undo2, Redo2, Wand2, AlertTriangle,
  FolderOpen, Clock, Grid3X3, Bot, LogOut, Route,
} from 'lucide-react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useMissionLibraryStore } from '@/lib/store/mission-library-store';
import { useTenantStore } from '@/lib/store/tenant-store';
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
import { MissionLibraryPanel } from '@/components/mission/mission-library-panel';
import { TemplatePicker } from '@/components/mission/template-picker';
import { TerrainPanel } from '@/components/mission/terrain-panel';
import { TimelinePanel } from '@/components/mission/timeline-panel';
import { TenantSelector } from '@/components/mission/tenant-selector';
import { MissionPromptBar } from '@/components/agent-console/mission-prompt-bar';
import { AgentConsole } from '@/components/agent-console/agent-console';
import { useMissionPlannerShortcuts } from '@/hooks/useKeyboardShortcuts';
import { missionSanityCheck, exportMissionAsV1Json, makeExportFilename } from '@/lib/services/mission-builder';
import { optimiseRoute, generateAlternativeRoutes } from '@/lib/services/route-optimizer';
import { computeRiskScore } from '@/lib/services/risk-scorer';
import { computeMissionMetrics } from '@/lib/services/metrics-service';
import { supportsCoordinates } from '@/lib/mavlink/commands';

// Risk gauge SVG
function RiskGauge({ score, level }: { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const color = level === 'LOW' ? '#00ff41' : level === 'MEDIUM' ? '#ffaa00' : '#ff3333';
  const r = 12;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;

  return (
    <div title={`Risk Score: ${score.toFixed(0)}/100 — ${level}`}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'default' }}>
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
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '8px', fontWeight: 700 }}>
          {score.toFixed(0)}
        </text>
      </svg>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color }}>
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
  hoverColor,
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
  /** Text color to switch to on hover — for one-off cases like the destructive Logout button. */
  hoverColor?: string;
}) {
  const [hover, setHover] = useState(false);

  let background = 'none';
  let border = 'transparent';
  let color = disabled ? 'var(--color-text-muted)' : 'var(--color-text-dim)';

  if (variant === 'default') {
    background = active ? 'var(--color-bg-raised)' : hover ? 'var(--color-bg-raised)' : 'none';
    border = active ? 'var(--color-border-hi)' : 'var(--color-border-mid)';
    color = active || hover ? 'var(--color-text)' : 'var(--color-text-dim)';
  } else if (variant === 'ghost') {
    background = hover && !disabled ? 'var(--color-bg-raised)' : 'none';
    color = disabled ? 'var(--color-text-muted)' : hover ? 'var(--color-text)' : 'var(--color-text-dim)';
  } else if (variant === 'accent') {
    background = hover ? 'rgba(0,255,65,0.2)' : 'var(--color-green-bg)';
    border = 'var(--color-green)';
    color = 'var(--color-green)';
  }

  if (hover && hoverColor && !disabled) color = hoverColor;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: label ? '4px' : 0,
        height: '24px', minWidth: label ? undefined : '24px', padding: label ? '0 8px' : '0',
        background, border: `1px solid ${border}`, borderRadius: 'var(--radius-sm)', color,
        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: variant === 'accent' ? 700 : 400,
        letterSpacing: variant === 'accent' ? '0.3px' : undefined,
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 150ms ease', whiteSpace: 'nowrap',
      }}
    >
      {Icon && <Icon size={iconSize} color={iconColor} />}
      {label}
    </button>
  );
}

/** Vertical rule between toolbar groups. */
function ToolbarDivider() {
  return <div style={{ width: '1px', height: '18px', backgroundColor: 'var(--color-border)', margin: '0 3px', flexShrink: 0 }} />;
}

/** Syncs mission-store writes → library and sets up initial state. */
function LibraryBridge() {
  const mission = useMissionStore((s) => s.mission);
  const { syncMission, missions, createMission: libCreate } = useMissionLibraryStore();
  const { loadMission: storeLoad, mission: curMission } = useMissionStore();
  const {
    tenants, activeTenantId, ensureDefault, assignMissionToTenant,
  } = useTenantStore();
  const initializedRef = useRef(false);

  // Sync mission-store writes to library
  useEffect(() => {
    if (mission) syncMission(mission);
  }, [mission, syncMission]);

  // Boot: ensure tenant + at least one mission
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const existingIds = Object.keys(missions);

    // Ensure default tenant
    if (Object.keys(tenants).length === 0) {
      ensureDefault(existingIds);
    }

    const tenantId = activeTenantId ?? Object.keys(tenants)[0];

    // If library is empty, create an initial mission
    if (existingIds.length === 0) {
      const newMission = libCreate();
      if (tenantId) assignMissionToTenant(newMission.id, tenantId);
      storeLoad(newMission);
    } else if (!curMission) {
      // Library has missions but store doesn't — load the most recent
      const sorted = Object.values(missions).sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt)
      );
      storeLoad(sorted[0]);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

function TopBar() {
  const {
    mission,
    updateMissionName,
    undo,
    redo,
    canUndo,
    canRedo,
    reorderMissionItems,
  } = useMissionStore();
  const {
    addToast,
    setAlternativeRoutes,
    clearAlternativeRoutes,
    alternativeRoutes,
    toggleMissionLibrary,
    toggleTemplatePicker,
    toggleTimeline,
    timelineOpen,
    missionLibraryOpen,
    templatePickerOpen,
  } = useUIStore();
  const { config, nfzs } = useConstraintsStore();
  const { geofences } = useGeofenceStore();
  const { getActiveTenant } = useTenantStore();
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

    const tenant = getActiveTenant();
    const metrics = computeMissionMetrics(mission.items, config, nfzs, mission.homePosition);
    const content = exportMissionAsV1Json(mission, {
      tenantId: tenant?.id ?? 'default',
      tenantName: tenant?.name ?? 'Default',
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
  }, [mission, config, nfzs, geofences, getActiveTenant, addToast]);

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
    const currentIds = mission.items.map((i) => i.id);
    const targetIds = result.reorderedItems.map((i) => i.id);
    const current = [...currentIds];
    for (let t = 0; t < targetIds.length; t++) {
      const from = current.indexOf(targetIds[t]);
      if (from !== t) {
        reorderMissionItems(from, t);
        const moved = current.splice(from, 1)[0];
        current.splice(t, 0, moved);
      }
    }
    addToast(`Route optimised — saved ${Math.round(result.savedM)} m`, 'success');
  }, [mission, addToast, reorderMissionItems]);

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
    <div style={{ backgroundColor: '#050505', borderBottom: '1px solid var(--color-border-mid)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {/* Warnings banner */}
      {warnings.length > 0 && !warningsDismissed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 12px', backgroundColor: 'rgba(255,170,0,0.08)', borderBottom: '1px solid rgba(255,170,0,0.3)' }}>
          <AlertTriangle size={12} color="var(--color-amber)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-amber)', flex: 1 }}>
            {warnings[0].message}{warnings.length > 1 && ` (+${warnings.length - 1} more)`}
          </span>
          <button onClick={() => setWarningsDismissed(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '11px', padding: '0 4px' }}>✕</button>
        </div>
      )}

      {/* Main row, grouped left→right: brand+context, command, edit history, route tools, panels, status/export/account */}
      <div style={{ display: 'flex', alignItems: 'center', height: '38px', padding: '0 8px', borderBottom: '1px solid var(--color-border)', gap: '4px' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px', flexShrink: 0 }}>
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
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-green)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>MPS</span>
        </div>

        {/* Context: tenant + mission name */}
        <TenantSelector />
        <ToolbarDivider />
        {mission && (editingName ? (
          <input type="text" value={nameValue} onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false); }}
            autoFocus
            style={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-green)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: '12px', padding: '2px 6px', outline: 'none', width: '160px' }}
          />
        ) : (
          <button onClick={() => { setNameValue(mission.name); setEditingName(true); }}
            title="Click to rename"
            style={{ background: 'none', border: 'none', color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: '2px 6px', borderRadius: 'var(--radius-sm)', transition: 'background 150ms ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-raised)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
            {mission.name}
          </button>
        ))}

        <ToolbarDivider />

        {/* Command: ask Flight Deck to plan */}
        <MissionPromptBar />

        <div style={{ flex: 1 }} />

        {/* Edit history */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <ToolbarButton icon={Undo2} iconSize={13} variant="ghost" title="Undo (Ctrl+Z)"
            disabled={!canUndo()} onClick={() => { undo(); addToast('Undo', 'info'); }} />
          <ToolbarButton icon={Redo2} iconSize={13} variant="ghost" title="Redo (Ctrl+Y)"
            disabled={!canRedo()} onClick={() => { redo(); addToast('Redo', 'info'); }} />
        </div>

        <ToolbarDivider />

        {/* Route tools */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <ToolbarButton icon={Wand2} label="Optimise" title="Optimise route" onClick={handleOptimise} />
          {spatialCount >= 4 && (
            <ToolbarButton icon={Route} label="Alternatives" title="Alternative routes"
              active={alternativeRoutes.length > 0} onClick={handleAlternatives} />
          )}
        </div>

        <ToolbarDivider />

        {/* Panels */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <ToolbarButton icon={Grid3X3} label="Templates" title="Mission templates (T)"
            active={templatePickerOpen} onClick={toggleTemplatePicker} />
          <ToolbarButton icon={FolderOpen} label="Missions" title="Mission library (Ctrl+M)" ariaLabel="Open mission library"
            active={missionLibraryOpen} onClick={toggleMissionLibrary} />
          <ToolbarButton icon={Clock} label="Timeline" title="Timeline (Ctrl+T)" ariaLabel="Toggle timeline"
            active={timelineOpen} onClick={toggleTimeline} />
          <ToolbarButton icon={Bot} label="Flight Deck" title="Flight Deck agent console"
            iconColor={flightDeckStatus === 'running' ? 'var(--color-cyan)' : undefined}
            active={consoleOpen} onClick={toggleConsole} />
        </div>

        <ToolbarDivider />

        {/* Status */}
        {riskBreakdown && (
          <div style={{ marginRight: '4px' }}>
            <RiskGauge score={riskBreakdown.total} level={riskBreakdown.level} />
          </div>
        )}

        {/* Export */}
        <div ref={exportRef} style={{ position: 'relative' }}>
          <ToolbarButton icon={Download} label="EXPORT JSON" variant="accent" title="Export mission JSON (Ctrl+S)"
            onClick={() => setExportOpen((v) => !v)} />

          {exportOpen && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: '2px',
              backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
              borderRadius: 'var(--radius-md)', zIndex: 9999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)', minWidth: '200px', overflow: 'hidden',
            }}>
              <button onClick={handleExportClick}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  width: '100%', padding: '8px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 100ms ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-green)', fontWeight: 600 }}>
                  Mission JSON (.json)
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
                  MPS v1 format — complete structure
                </span>
              </button>
            </div>
          )}
        </div>

        <ToolbarDivider />

        {/* Account */}
        <ToolbarButton icon={LogOut} title="Sign out" hoverColor="var(--color-red)"
          onClick={() => { fetch('/api/auth/logout', { method: 'POST' }).finally(() => { window.location.href = '/'; }); }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '32px', paddingLeft: '4px' }}>
        <button style={{
          display: 'flex', alignItems: 'center', padding: '0 16px',
          background: 'var(--color-bg-base)', border: 'none',
          borderBottom: '2px solid var(--color-green)',
          borderTop: '1px solid var(--color-border-mid)',
          color: 'var(--color-text)', fontFamily: 'var(--font-sans)',
          fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          Flight Plan
        </button>
      </div>

      {/* Export sanity confirm modal */}
      {exportConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div style={{ backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-amber)', borderRadius: 'var(--radius-md)', padding: '20px 24px', maxWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.8)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={16} color="var(--color-amber)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 700, color: 'var(--color-text)' }}>Mission has warnings</span>
            </div>
            <div style={{ marginBottom: '10px' }}>
              {warnings.slice(0, 4).map((w, i) => (
                <div key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-amber)', padding: '2px 0' }}>• {w.message}</div>
              ))}
              {warnings.length > 4 && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)' }}>+{warnings.length - 4} more</div>}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setExportConfirm(false)} style={{ padding: '5px 14px', background: 'none', border: '1px solid var(--color-border-mid)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>Cancel</button>
              <button onClick={doExport} style={{ padding: '5px 14px', backgroundColor: 'var(--color-amber-bg)', border: '1px solid var(--color-amber)', borderRadius: 'var(--radius-sm)', color: 'var(--color-amber)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}>Export Anyway</button>
            </div>
          </div>
        </div>
      )}
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
      style={{ height: '5px', backgroundColor: 'var(--color-border-mid)', cursor: 'row-resize', flexShrink: 0, transition: 'background 100ms ease' }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-green-dim)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-border-mid)'; }}
      title="Drag to resize table"
    />
  );
}

function AlternativesPanel() {
  const { alternativeRoutes, clearAlternativeRoutes, addToast } = useUIStore();
  const { reorderMissionItems, mission } = useMissionStore();

  if (alternativeRoutes.length === 0) return null;

  const applyRoute = (route: typeof alternativeRoutes[0]) => {
    if (!mission) return;
    const currentIds = mission.items.map((i) => i.id);
    const targetIds = route.itemIds;
    const current = [...currentIds];
    for (let t = 0; t < targetIds.length; t++) {
      const from = current.indexOf(targetIds[t]);
      if (from !== t) {
        reorderMissionItems(from, t);
        const moved = current.splice(from, 1)[0];
        current.splice(t, 0, moved);
      }
    }
    clearAlternativeRoutes();
    addToast(`Applied ${route.label}`, 'success');
  };

  return (
    <div style={{ position: 'fixed', bottom: 260, right: 16, zIndex: 1000, backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)', borderRadius: 'var(--radius-md)', padding: '10px 12px', minWidth: '240px', boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alternative Routes</span>
        <button onClick={clearAlternativeRoutes} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>✕</button>
      </div>
      {alternativeRoutes.map((route) => (
        <div key={route.id} style={{ marginBottom: '8px', padding: '8px', borderRadius: 'var(--radius-sm)', border: `1px solid ${route.color}22`, backgroundColor: `${route.color}11` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 600, color: route.color }}>{route.label}</span>
            <button onClick={() => applyRoute(route)} style={{ padding: '2px 8px', backgroundColor: `${route.color}22`, border: `1px solid ${route.color}`, borderRadius: '2px', color: route.color, fontFamily: 'var(--font-mono)', fontSize: '9px', cursor: 'pointer' }}>
              Use this
            </button>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {timelineOpen && <TimelinePanel />}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
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
  const { missionLibraryOpen, templatePickerOpen } = useUIStore();

  const handleTableResize = useCallback((delta: number) => {
    setTableHeight((prev) => {
      const next = prev + delta;
      return Math.max(120, Math.min(window.innerHeight * 0.6, next));
    });
  }, []);

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text)',
    }}>
      <LibraryBridge />
      <KeyboardShortcutsMount />
      <TopBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <FlightPlanView tableHeight={tableHeight} onTableResize={handleTableResize} />
      </div>
      <AlternativesPanel />
      <ToastContainer />
      <AgentConsole />
      {missionLibraryOpen && <MissionLibraryPanel />}
      {templatePickerOpen && <TemplatePicker />}
    </div>
  );
}
