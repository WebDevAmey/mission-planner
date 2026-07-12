'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { MISSION_TEMPLATES, createMissionFromTemplate } from '@/lib/templates/mission-templates';
import { useMissionLibraryStore } from '@/lib/store/mission-library-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTenantStore } from '@/lib/store/tenant-store';
import { useUIStore } from '@/lib/store/ui-store';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_SETTINGS = {
  defaultAltitude: 80,
  defaultSpeed: 12,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative' as const,
};

export function TemplatePicker() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { syncMission } = useMissionLibraryStore();
  const { loadMission: storeLoad, mission: activeMission } = useMissionStore();
  const { getActiveTenant, assignMissionToTenant } = useTenantStore();
  const { setTemplatePickerOpen, addToast } = useUIStore();

  const selected = MISSION_TEMPLATES.find((t) => t.id === selectedId);

  const handleUse = () => {
    if (!selected) return;

    const home = activeMission?.homePosition;
    const homeLat = home?.latitude ?? 0;
    const homeLng = home?.longitude ?? 0;
    const settings = activeMission?.settings ?? DEFAULT_SETTINGS;

    const partial = createMissionFromTemplate(selected, homeLat, homeLng, settings);
    const now = new Date().toISOString();
    const newMission = {
      ...partial,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
    };

    syncMission(newMission);
    const tenant = getActiveTenant();
    if (tenant) assignMissionToTenant(newMission.id, tenant.id);
    storeLoad(newMission);
    addToast(`Created mission from template "${selected.name}"`, 'success');
    setTemplatePickerOpen(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
    }}>
      <div style={{
        width: '600px', maxHeight: '480px',
        backgroundColor: 'var(--color-bg-panel)',
        border: '1px solid var(--color-border-mid)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
        animation: 'fadeIn 150ms ease',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderBottom: '1px solid var(--color-border-mid)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Choose a Mission Template
          </span>
          <button onClick={() => setTemplatePickerOpen(false)}
            aria-label="Close template picker"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Info banner */}
        <div style={{
          padding: '6px 16px', backgroundColor: 'rgba(45,125,210,0.08)',
          borderBottom: '1px solid rgba(45,125,210,0.2)',
          fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-blue)',
        }}>
          This will create a new mission. Your current mission is saved and accessible in the Missions panel.
        </div>

        {/* Template grid */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
        }}>
          {MISSION_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() => setSelectedId(tmpl.id === selectedId ? null : tmpl.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                padding: '12px', background: 'none',
                border: `1px solid ${tmpl.id === selectedId ? 'var(--color-green)' : 'var(--color-border-mid)'}`,
                borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left',
                backgroundColor: tmpl.id === selectedId ? 'var(--color-green-bg)' : 'var(--color-bg-raised)',
                transition: 'all 150ms ease',
              }}
              aria-label={`Select template: ${tmpl.name}`}
            >
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{tmpl.icon}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
                {tmpl.name}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '6px', lineHeight: 1.4 }}>
                {tmpl.description}
              </div>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {tmpl.tags.map((tag) => (
                  <span key={tag} style={{
                    fontFamily: 'var(--font-mono)', fontSize: '8px',
                    backgroundColor: 'var(--color-bg-hover)', color: 'var(--color-text-dim)',
                    border: '1px solid var(--color-border-mid)', borderRadius: '2px',
                    padding: '1px 4px',
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px',
          padding: '10px 16px', borderTop: '1px solid var(--color-border-mid)',
        }}>
          <button onClick={() => setTemplatePickerOpen(false)}
            style={{ padding: '5px 14px', background: 'none', border: '1px solid var(--color-border-mid)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
            Cancel
          </button>
          <button
            onClick={handleUse}
            disabled={!selectedId}
            aria-label="Use selected template"
            style={{
              padding: '5px 16px',
              backgroundColor: selectedId ? 'var(--color-green-bg)' : 'var(--color-bg-raised)',
              border: `1px solid ${selectedId ? 'var(--color-green)' : 'var(--color-border-mid)'}`,
              borderRadius: 'var(--radius-sm)',
              color: selectedId ? 'var(--color-green)' : 'var(--color-text-muted)',
              cursor: selectedId ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            }}>
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
