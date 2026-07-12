'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { useTenantStore } from '@/lib/store/tenant-store';
import { useMissionLibraryStore } from '@/lib/store/mission-library-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';

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
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch organisation"
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          height: '24px', padding: '0 8px',
          background: 'none', border: '1px solid var(--color-border-mid)',
          borderRadius: 'var(--radius-sm)', cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-bg-raised)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: activeTenant?.color ?? '#888', flexShrink: 0,
        }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text)', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {activeTenant?.name ?? 'No Org'}
        </span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '2px',
          zIndex: 9000, minWidth: '220px',
          backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
          borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Organisations
          </div>

          {tenantList.map((tenant) => (
            <div key={tenant.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 10px',
                backgroundColor: tenant.id === activeTenantId ? 'rgba(0,255,65,0.05)' : 'transparent',
                borderBottom: '1px solid var(--color-border)',
              }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: tenant.color, flexShrink: 0 }} />

              {editingId === tenant.id ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { renameTenant(tenant.id, editName); setEditingId(null); }
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  style={{
                    flex: 1, background: 'var(--color-bg-raised)', border: '1px solid var(--color-green)',
                    borderRadius: '2px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                    fontSize: '10px', padding: '1px 4px', outline: 'none',
                  }}
                />
              ) : (
                <span
                  onClick={() => handleSwitch(tenant.id)}
                  style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '10px', color: tenant.id === activeTenantId ? 'var(--color-green)' : 'var(--color-text)', cursor: 'pointer' }}>
                  {tenant.name}
                  {tenant.id === activeTenantId && ' ✓'}
                </span>
              )}

              <button onClick={() => { setEditingId(tenant.id); setEditName(tenant.name); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: '1px' }}>
                <Edit2 size={10} />
              </button>
              <button onClick={() => handleDelete(tenant.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: '1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-red)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}

          {/* New org */}
          {creatingNew ? (
            <div style={{ padding: '8px 10px', borderTop: '1px solid var(--color-border)' }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Organisation name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreatingNew(false); }}
                autoFocus
                style={{
                  width: '100%', marginBottom: '6px', padding: '3px 6px',
                  backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-green)',
                  borderRadius: '2px', color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
                  fontSize: '10px', outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)}
                    style={{
                      width: '14px', height: '14px', borderRadius: '50%', backgroundColor: c,
                      border: c === newColor ? '2px solid #fff' : '1px solid transparent',
                      cursor: 'pointer', padding: 0,
                    }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleCreate}
                  style={{ flex: 1, padding: '3px', backgroundColor: 'var(--color-green-bg)', border: '1px solid var(--color-green)', borderRadius: '2px', color: 'var(--color-green)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                  <Check size={10} /> Create
                </button>
                <button onClick={() => setCreatingNew(false)}
                  style={{ flex: 1, padding: '3px', background: 'none', border: '1px solid var(--color-border-mid)', borderRadius: '2px', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setCreatingNew(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                width: '100%', padding: '7px 10px', background: 'none', border: 'none',
                cursor: 'pointer', borderTop: '1px solid var(--color-border)',
                fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)'; }}>
              <Plus size={11} /> New Organisation
            </button>
          )}
        </div>
      )}
    </div>
  );
}
