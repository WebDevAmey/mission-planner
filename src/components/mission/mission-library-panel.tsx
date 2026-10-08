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
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button, IconButton } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';

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

const RISK_VARIANT: Record<string, 'green' | 'amber' | 'red'> = {
  LOW: 'green',
  MEDIUM: 'amber',
  HIGH: 'red',
};

function RiskBadge({ score, level }: { score: number; level: string }) {
  return <Badge variant={RISK_VARIANT[level] ?? 'neutral'}>{score.toFixed(0)} {level}</Badge>;
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

  const MENU_ITEMS = [
    { label: 'Rename', icon: <Edit2 size={11} />, action: () => { setEditingName(true); setNameValue(mission.name); setMenuOpen(false); } },
    { label: 'Duplicate', icon: <Copy size={11} />, action: () => { onDuplicate(); setMenuOpen(false); } },
    { label: 'Export', icon: <Download size={11} />, action: () => { onExport(); setMenuOpen(false); } },
    { label: 'Delete', icon: <Trash2 size={11} />, action: () => { onDelete(); setMenuOpen(false); }, danger: true },
  ];

  return (
    <div
      onClick={onLoad}
      className={cn(
        'relative mb-1.5 cursor-pointer rounded-md border px-2.5 py-2 transition-colors duration-150',
        isActive ? 'border-green bg-green-bg' : 'border-border-mid bg-bg-raised'
      )}
    >
      {/* Name row */}
      <div className="mb-1 flex items-center justify-between">
        {editingName ? (
          <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingName(false);
              }}
              autoFocus
              className="flex-1 rounded-[2px] border border-green bg-bg-raised px-1 py-0.5 font-mono text-[11px] text-text outline-none"
            />
            <button onClick={commitRename} aria-label="Confirm rename" className="flex text-green">
              <Check size={12} />
            </button>
          </div>
        ) : (
          <span
            className={cn(
              'flex-1 truncate font-mono text-[11px] font-semibold',
              isActive ? 'text-green' : 'text-text'
            )}
            onDoubleClick={(e) => { e.stopPropagation(); setEditingName(true); setNameValue(mission.name); }}
          >
            {mission.name}
          </span>
        )}
        <IconButton
          icon={<MoreHorizontal size={13} />}
          aria-label="Mission actions"
          size="xs"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        />
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[9px] text-text-muted">{relativeTime(mission.updatedAt)}</span>
        <span className="font-mono text-[9px] text-text-muted">{spatialCount} WP</span>
        <span className="font-mono text-[9px] text-text-muted">
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
          className="absolute right-2 top-8 z-[9999] min-w-[140px] overflow-hidden rounded-md border border-border-mid bg-bg-raised shadow-xl"
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className={cn(
                'flex w-full items-center gap-1.5 border-b border-border px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors hover:bg-bg-hover',
                item.danger ? 'text-red' : 'text-text'
              )}
            >
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
    <div className="fixed inset-y-0 left-0 z-[5000] flex">
      {/* Backdrop */}
      <div
        onClick={() => setMissionLibraryOpen(false)}
        className="fixed inset-0 z-[5000] bg-black/50"
      />
      {/* Drawer */}
      <div className="relative z-[5001] flex h-full w-80 flex-col border-r border-border-mid bg-bg-panel shadow-[4px_0_24px_rgba(0,0,0,0.6)] animate-[slideInLeft_200ms_ease]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-mid bg-[#0d0d0d] px-3 py-2">
          <div className="flex items-center gap-2">
            <FolderOpen size={14} className="text-green" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-text">
              Missions
            </span>
            {tenant && (
              <span className="rounded-[2px] border border-border-mid px-1 py-px font-mono text-[9px] text-text-muted">
                {tenant.name}
              </span>
            )}
          </div>
          <IconButton icon={<X size={14} />} aria-label="Close mission library" size="sm" onClick={() => setMissionLibraryOpen(false)} />
        </div>

        {/* Search + New */}
        <div className="shrink-0 border-b border-border px-3 py-2">
          <div className="mb-1.5 flex gap-1.5">
            <div className="relative flex-1">
              <Search size={11} className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search missions…"
                className="h-[26px] pl-[22px]"
              />
            </div>
            <Button
              size="sm"
              aria-label="New mission"
              onClick={handleNew}
              className="shrink-0 border-green bg-green-bg font-mono text-green hover:bg-green/20"
            >
              <Plus size={11} /> New
            </Button>
          </div>
          <div className="font-mono text-[9px] text-text-muted">
            {filtered.length} mission{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Mission list */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {filtered.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title={search ? 'No matching missions' : 'No missions yet'}
              description={search ? undefined : 'Create one to start planning a flight.'}
            />
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
      <Dialog open={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} size="sm" className="border-red/40">
        <DialogBody>
          <div className="mb-1.5 font-mono text-[13px] font-bold text-text">Delete Mission?</div>
          <p className="font-sans text-xs text-text-muted">
            This cannot be undone. The mission will be permanently removed.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            className="border-red bg-red-bg font-mono font-bold text-red hover:bg-red/20"
          >
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
