'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useTenantStore } from '@/lib/store/tenant-store';
import { useMissionLibraryStore } from '@/lib/store/mission-library-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { cn } from '@/lib/utils';

const PRESET_COLORS = [
  '#2d7dd2', '#00cc66', '#ff6b35', '#9b59b6',
  '#e74c3c', '#f39c12', '#1abc9c', '#e67e22',
];

export function TenantSelector() {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { tenants, activeTenantId, createTenant, switchTenant, renameTenant, deleteTenant } =
    useTenantStore();
  const { getMissionsByIds } = useMissionLibraryStore();
  const { loadMission: storeLoad } = useMissionStore();
  const { addToast } = useUIStore();

  const activeTenant = activeTenantId ? tenants[activeTenantId] : null;
  const tenantList = Object.values(tenants);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSwitch = (id: string) => {
    switchTenant(id);
    // Load most recent mission of this tenant
    const tenant = tenants[id];
    if (tenant) {
      const missions = getMissionsByIds(tenant.missionIds);
      if (missions.length > 0) storeLoad(missions[0]);
    }
    addToast(`Switched to "${tenants[id]?.name}"`, 'info');
    setOpen(false);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const id = createTenant(newName.trim(), newColor);
    addToast(`Organisation "${newName.trim()}" created`, 'success');
    setNewName('');
    setNewColor(PRESET_COLORS[0]);
    setCreatingNew(false);
    switchTenant(id);
  };

  const handleDelete = (id: string) => {
    if (tenantList.length <= 1) { addToast('Cannot delete the only organisation', 'error'); return; }
    deleteTenant(id);
    addToast('Organisation deleted', 'info');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch organisation"
        className="flex h-6 items-center gap-1.5 rounded-sm border border-border-mid px-2 transition-colors hover:bg-bg-raised"
      >
        <div
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: activeTenant?.color ?? '#888' }}
        />
        <span className="max-w-[100px] overflow-hidden whitespace-nowrap font-mono text-[10px] text-text text-ellipsis">
          {activeTenant?.name ?? 'No Org'}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[9000] mt-0.5 min-w-[220px] overflow-hidden rounded-md border border-border-mid bg-bg-raised shadow-2xl">
          <div className="border-b border-border px-2 py-1.5 font-mono text-[9px] uppercase tracking-wide text-text-muted">
            Organisations
          </div>

          {tenantList.map((tenant) => (
            <div
              key={tenant.id}
              className={cn(
                'flex items-center gap-1.5 border-b border-border px-2.5 py-1.5',
                tenant.id === activeTenantId && 'bg-green-bg'
              )}
            >
              <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tenant.color }} />

              {editingId === tenant.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameTenant(tenant.id, editName); setEditingId(null); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="flex-1 rounded-[2px] border border-green bg-bg-raised px-1 py-0.5 font-mono text-[10px] text-text outline-none"
                />
              ) : (
                <span
                  onClick={() => handleSwitch(tenant.id)}
                  className={cn(
                    'flex-1 cursor-pointer font-mono text-[10px]',
                    tenant.id === activeTenantId ? 'text-green' : 'text-text'
                  )}
                >
                  {tenant.name}
                  {tenant.id === activeTenantId && ' ✓'}
                </span>
              )}

              <button
                onClick={() => { setEditingId(tenant.id); setEditName(tenant.name); }}
                aria-label={`Rename ${tenant.name}`}
                className="flex p-0.5 text-text-muted transition-colors hover:text-text"
              >
                <Edit2 size={10} />
              </button>
              <button
                onClick={() => handleDelete(tenant.id)}
                aria-label={`Delete ${tenant.name}`}
                className="flex p-0.5 text-text-muted transition-colors hover:text-red"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}

          {/* New org */}
          {creatingNew ? (
            <div className="border-t border-border px-2.5 py-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Organisation name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreatingNew(false); }}
                autoFocus
                className="mb-1.5 w-full rounded-[2px] border border-green bg-bg-raised px-1.5 py-0.5 font-mono text-[10px] text-text outline-none"
              />
              <div className="mb-1.5 flex gap-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    aria-label={`Use color ${c}`}
                    className="h-3.5 w-3.5 rounded-full p-0"
                    style={{ backgroundColor: c, border: c === newColor ? '2px solid #fff' : '1px solid transparent' }}
                  />
                ))}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handleCreate}
                  className="flex-1 rounded-[2px] border border-green bg-green-bg py-0.5 font-mono text-[9px] text-green"
                >
                  <Check size={10} className="inline" /> Create
                </button>
                <button
                  onClick={() => setCreatingNew(false)}
                  className="flex-1 rounded-[2px] border border-border-mid py-0.5 font-mono text-[9px] text-text-muted"
                >
                  <X size={10} className="inline" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="flex w-full items-center gap-1.5 border-t border-border px-2.5 py-1.5 font-mono text-[10px] text-text-muted transition-colors hover:text-text"
            >
              <Plus size={11} /> New Organisation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
