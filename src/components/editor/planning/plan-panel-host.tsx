'use client';

import { useUIStore } from '@/lib/store/ui-store';
import { Button } from '@/components/base/buttons/button';

/** Hosts the active planner (survey / optimise / avoid) inside the Waypoints tab. */
export function PlanPanelHost() {
  const panel = useUIStore((s) => s.planPanel);
  const openPlanPanel = useUIStore((s) => s.openPlanPanel);
  if (!panel) return null;
  return (
    <div className="flex flex-col gap-3 px-4">
      <p className="text-body-2-regular text-text-secondary">This planner is not available yet.</p>
      <Button size="small" variant="secondary" onClick={() => openPlanPanel(null)}>
        Back
      </Button>
    </div>
  );
}
