'use client';

import React, { useState } from 'react';
import { FolderOpen, Plus, Search, X, MoreHorizontal, Trash2, Copy, Download, Edit2, Check } from 'lucide-react';
import { useMissionLibraryStore } from '@/lib/store/mission-library-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTenantStore } from '@/lib/store/tenant-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { useUIStore } from '@/lib/store/ui-store';
import { computeMissionMetrics } from '@/lib/services/metrics-service';
import { exportMissionAsV1Json, makeExportFilename } from '@/lib/services/mission-builder';
import type { MissionPlan } from '@/types/mission';

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RiskBadge({ score, level }: { score: number; level: string }) {
  const color =
    level === 'LOW' ? 'var(--color-green)'
      : level === 'MEDIUM' ? 'var(--color-amber)'
      : 'var(--color-red)';
  return (
    <span style={{
      fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
      color, border: `1px solid ${color}`, borderRadius: '2px',
      padding: '1px 4px',
    }}>
      {score.toFixed(0)} {level}
    </span>
  );
}

interface MissionCardProps {
  mission: MissionPlan;
  isActive: boolean;
  onLoad: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
}

function MissionCard({ mission, isActive, onLoad, onDelete, onDuplicate, onExport }: MissionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(mission.name);
  const { renameMission } = useMissionLibraryStore();
  const { config, nfzs } = useConstraintsStore();

  const metrics = computeMissionMetrics(mission.items, config, nfzs, mission.homePosition);
  const spatialCount = metrics.spatialWaypoints;

  const commitRename = () => {
    if (nameValue.trim()) renameMission(mission.id, nameValue.trim());
    setEditingName(false);
  };

  return (
    <div
      onClick={onLoad}
      style={{
        padding: '8px 10px',
        backgroundColor: isActive ? 'rgba(0,255,65,0.08)' : 'var(--color-bg-raised)',
        border: `1px solid ${isActive ? 'var(--color-green)' : 'var(--color-border-mid)'}`,
        borderRadius: 'var(--radius-md)',
        marginBottom: '6px',
        cursor: 'pointer',
        transition: 'border-color 150ms ease',
        position: 'relative',
      }}
    >
      {/* Name row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        {editingName ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}
            onClick={(e) => e.stopPropagation()}>
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingName(false);
              }}
              autoFocus
              style={{
                flex: 1, background: 'var(--color-bg-raised)', border: '1px solid var(--color-green)',
                borderRadius: '2px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                fontSize: '11px', padding: '1px 4px', outline: 'none',
              }}
            />
            <button onClick={commitRename} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-green)', display: 'flex' }}>
              <Check size={12} />
            </button>
          </div>
        ) : (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 600,
            color: isActive ? 'var(--color-green)' : 'var(--color-text)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); setNameValue(mission.name); }}>
            {mission.name}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: '1px', flexShrink: 0 }}
        >
          <MoreHorizontal size={13} />
        </button>
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
          {relativeTime(mission.updatedAt)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
          {spatialCount} WP
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
          {metrics.totalDistanceM >= 1000
            ? `${(metrics.totalDistanceM / 1000).toFixed(1)}km`
            : `${Math.round(metrics.totalDistanceM)}m`}
        </span>
        <RiskBadge score={metrics.riskScore} level={metrics.riskLevel} />
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute', right: 8, top: 32, zIndex: 9999,
            backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            minWidth: '140px', overflow: 'hidden',
          }}
        >
          {[
            { label: 'Rename', icon: <Edit2 size={11} />, action: () => { setEditingName(true); setNameValue(mission.name); setMenuOpen(false); } },
            { label: 'Duplicate', icon: <Copy size={11} />, action: () => { onDuplicate(); setMenuOpen(false); } },
            { label: 'Export', icon: <Download size={11} />, action: () => { onExport(); setMenuOpen(false); } },
            { label: 'Delete', icon: <Trash2 size={11} />, action: () => { onDelete(); setMenuOpen(false); }, danger: true },
          ].map((item) => (
            <button key={item.label} onClick={item.action}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '6px 10px', background: 'none', border: 'none',
                cursor: 'pointer', color: item.danger ? 'var(--color-red)' : 'var(--color-text)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', textAlign: 'left',
                borderBottom: '1px solid var(--color-border)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function MissionLibraryPanel() {
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { getMissionsByIds, createMission, loadMission, deleteMission, duplicateMission, activeMissionId } =
    useMissionLibraryStore();
  const { loadMission: storeLoad, createMission: storeCreate, mission: activeMission } = useMissionStore();
  const { getActiveTenant, assignMissionToTenant } = useTenantStore();
  const { config, nfzs } = useConstraintsStore();
  const { geofences } = useGeofenceStore();
  const { addToast, setMissionLibraryOpen } = useUIStore();

  const tenant = getActiveTenant();
  const missionIds = tenant?.missionIds ?? [];
  const allMissions = getMissionsByIds(missionIds);
  const filtered = search.trim()
    ? allMissions.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    : allMissions;

  const handleLoad = (mission: MissionPlan) => {
    loadMission(mission.id);
    storeLoad(mission);
    addToast(`Loaded "${mission.name}"`, 'success');
  };

  const handleNew = () => {
    const newMission = createMission();
    if (tenant) assignMissionToTenant(newMission.id, tenant.id);
    storeLoad(newMission);
    addToast(`Created "${newMission.name}"`, 'success');
  };

  const handleDelete = (id: string) => {
    const next = deleteMission(id);
    if (next) {
      storeLoad(next);
    } else {
      storeCreate();
    }
    addToast('Mission deleted', 'info');
    setConfirmDeleteId(null);
  };

  const handleDuplicate = (id: string) => {
    const copy = duplicateMission(id);
    if (!copy) return;
    if (tenant) assignMissionToTenant(copy.id, tenant.id);
    storeLoad(copy);
    addToast(`Duplicated as "${copy.name}"`, 'success');
  };

  const handleExport = (exportMission: MissionPlan) => {
    const metrics = computeMissionMetrics(exportMission.items, config, nfzs, exportMission.homePosition);
    const content = exportMissionAsV1Json(exportMission, {
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
    a.download = makeExportFilename(exportMission.name);
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Exported "${exportMission.name}"`, 'success');
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 5000,
        display: 'flex',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={() => setMissionLibraryOpen(false)}
        style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 5000 }}
      />
      {/* Drawer */}
      <div style={{
        position: 'relative', zIndex: 5001,
        width: '320px', height: '100%',
        backgroundColor: 'var(--color-bg-panel)',
        borderRight: '1px solid var(--color-border-mid)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '4px 0 24px rgba(0,0,0,0.6)',
        animation: 'slideInLeft 200ms ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', backgroundColor: '#0d0d0d',
          borderBottom: '1px solid var(--color-border-mid)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={14} color="var(--color-green)" />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Missions
            </span>
            {tenant && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border-mid)', borderRadius: '2px', padding: '1px 4px',
              }}>
                {tenant.name}
              </span>
            )}
          </div>
          <button onClick={() => setMissionLibraryOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>

        {/* Search + New */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={11} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search missions…"
                style={{
                  width: '100%', paddingLeft: '22px', paddingRight: '6px', height: '26px',
                  backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
                  borderRadius: 'var(--radius-sm)', color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)', fontSize: '11px', outline: 'none',
                }}
              />
            </div>
            <button onClick={handleNew}
              aria-label="New mission"
              style={{
                display: 'flex', alignItems: 'center', gap: '3px', padding: '0 8px',
                backgroundColor: 'var(--color-green-bg)', border: '1px solid var(--color-green)',
                borderRadius: 'var(--radius-sm)', color: 'var(--color-green)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              <Plus size={11} /> New
            </button>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
            {filtered.length} mission{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Mission list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
              {search ? 'No matching missions' : 'No missions yet'}
            </div>
          ) : (
            filtered.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                isActive={mission.id === (activeMissionId ?? activeMission?.id)}
                onLoad={() => handleLoad(mission)}
                onDelete={() => setConfirmDeleteId(mission.id)}
                onDuplicate={() => handleDuplicate(mission.id)}
                onExport={() => handleExport(mission)}
              />
            ))
          )}
        </div>
      </div>

      {/* Delete confirm dialog */}
      {confirmDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-red)',
            borderRadius: 'var(--radius-md)', padding: '20px 24px', maxWidth: '320px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text)', marginBottom: '8px', fontWeight: 700 }}>
              Delete Mission?
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              This cannot be undone. The mission will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDeleteId(null)}
                style={{ padding: '5px 14px', background: 'none', border: '1px solid var(--color-border-mid)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDeleteId)}
                style={{ padding: '5px 14px', backgroundColor: 'var(--color-red-bg)', border: '1px solid var(--color-red)', borderRadius: 'var(--radius-sm)', color: 'var(--color-red)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
