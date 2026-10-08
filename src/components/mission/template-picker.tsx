'use client';

import React, { useState } from 'react';
import { MISSION_TEMPLATES, createMissionFromTemplate } from '@/lib/templates/mission-templates';
import { useMissionLibraryStore } from '@/lib/store/mission-library-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useTenantStore } from '@/lib/store/tenant-store';
import { useUIStore } from '@/lib/store/ui-store';
import { v4 as uuidv4 } from 'uuid';
import { Dialog, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  const close = () => setTemplatePickerOpen(false);

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
    close();
  };

  return (
    <Dialog open onClose={close} size="lg" className="flex max-h-[480px] w-[600px] max-w-[600px] flex-col">
      <DialogHeader onClose={close}>
        <DialogTitle className="uppercase tracking-wide">Choose a Mission Template</DialogTitle>
      </DialogHeader>

      <div className="border-b border-blue/20 bg-blue-bg px-4 py-1.5 font-mono text-[10px] text-blue">
        This will create a new mission. Your current mission is saved and accessible in the Missions panel.
      </div>

      <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-4">
        {MISSION_TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.id}
            onClick={() => setSelectedId(tmpl.id === selectedId ? null : tmpl.id)}
            aria-label={`Select template: ${tmpl.name}`}
            className={cn(
              'flex flex-col items-start rounded-md border p-3 text-left transition-colors duration-150',
              tmpl.id === selectedId ? 'border-green bg-green-bg' : 'border-border-mid bg-bg-raised'
            )}
          >
            <div className="mb-1.5 text-2xl">{tmpl.icon}</div>
            <div className="mb-1 font-mono text-[11px] font-bold text-text">
              {tmpl.name}
            </div>
            <div className="mb-1.5 font-sans text-[10px] leading-relaxed text-text-muted">
              {tmpl.description}
            </div>
            <div className="flex flex-wrap gap-1">
              {tmpl.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-[2px] border border-border-mid bg-bg-hover px-1 py-px font-mono text-[8px] text-text-dim"
                >
                  {tag}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={close}>Cancel</Button>
        <Button
          size="sm"
          disabled={!selectedId}
          aria-label="Use selected template"
          onClick={handleUse}
          className={cn(
            'font-mono font-bold',
            selectedId ? 'border-green bg-green-bg text-green hover:bg-green/20' : undefined
          )}
        >
          Use Template
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
