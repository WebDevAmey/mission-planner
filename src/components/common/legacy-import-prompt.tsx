'use client';

import { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RiHardDrive2Line } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { buildMissionPatch } from '@/hooks/mission-payload';
import { toEditorMission } from '@/lib/store/editor-types';
import { discardLegacyLocalData, readLegacyLocalData, type LegacyLocalData } from '@/lib/store/local-data';
import type { MissionPlan } from '@/types/mission';

interface ServerMissionRef {
  id: string;
  waypointCount: number;
}

interface ImportPlan {
  missions: { mission: MissionPlan; name: string }[];
  zoneCount: number;
  data: LegacyLocalData;
}

/** Which local missions are worth importing: ones the server has never seen, and
 * local copies whose items differ from the server (edits lost to the old save bug). */
function planImport(data: LegacyLocalData, server: ServerMissionRef[]): ImportPlan {
  const byId = new Map(server.map((m) => [m.id, m]));
  const missions: ImportPlan['missions'] = [];
  for (const m of data.missions) {
    const onServer = byId.get(m.id);
    if (!onServer) {
      if (m.items.length > 0 || m.name) missions.push({ mission: m, name: m.name || 'Imported mission' });
    } else if (m.items.length > 0 && m.items.length !== onServer.waypointCount) {
      missions.push({ mission: m, name: `${m.name} (recovered)` });
    }
  }
  return { missions, zoneCount: data.zones.length, data };
}

async function createMissionOnServer(name: string): Promise<string> {
  const res = await fetch('/api/missions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.slice(0, 200) }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.mission?.id) throw new Error(json?.error ?? 'Could not create a mission');
  return json.mission.id as string;
}

/**
 * One-time "Import N local missions / M zones into your account?" prompt
 * (TECHNICAL_SPEC §3.3). Reads the pre-server localStorage stores, imports through
 * the normal API, then deletes the keys. Nothing is uploaded without consent.
 */
export function LegacyImportPrompt({
  serverMissions,
  onImported,
}: {
  serverMissions: ServerMissionRef[] | null;
  onImported: () => void;
}) {
  const [data, setData] = useState<LegacyLocalData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(readLegacyLocalData());
  }, []);

  const plan = useMemo(
    () => (data && serverMissions ? planImport(data, serverMissions) : null),
    [data, serverMissions]
  );

  const nothingToImport = !!plan && plan.missions.length === 0 && plan.zoneCount === 0;
  useEffect(() => {
    // Only stale mirrors of server missions: nothing to recover, drop them.
    if (nothingToImport) discardLegacyLocalData();
  }, [nothingToImport]);

  if (hidden || !plan || nothingToImport) return null;

  const doImport = async () => {
    setBusy(true);
    setError(null);
    try {
      const zones = plan.data.zones;
      const targets = plan.missions.length > 0 ? plan.missions : [{ mission: null, name: 'Imported zones' }];
      for (const t of targets) {
        const id = await createMissionOnServer(t.name);
        const base = t.mission ?? {
          id,
          name: t.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          items: [],
          settings: { defaultAltitude: 80, defaultSpeed: 12, defaultLoiterTime: 30, defaultWaitTime: 10, altitudeReference: 'relative' as const },
          homePosition: null,
        };
        const doc = toEditorMission({ ...base, id, name: t.name });
        doc.zones = zones.map((z) => ({ ...z, id: uuidv4() }));
        doc.items = doc.items.map((item) => ({ ...item, id: uuidv4() }));
        const res = await fetch(`/api/missions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildMissionPatch(doc, null)),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => null);
          throw new Error(json?.error ?? `Could not import "${t.name}"`);
        }
      }
      discardLegacyLocalData();
      setHidden(true);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const parts = [
    plan.missions.length > 0 && `${plan.missions.length} local mission${plan.missions.length === 1 ? '' : 's'}`,
    plan.zoneCount > 0 && `${plan.zoneCount} zone${plan.zoneCount === 1 ? '' : 's'}`,
  ].filter(Boolean);

  return (
    <div
      role="region"
      aria-label="Import local data"
      className="flex flex-col gap-3 rounded-fd-control border border-separator-border bg-background-primary-default p-4 sm:flex-row sm:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <RiHardDrive2Line className="mt-0.5 size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-body-2-medium text-text-primary">Import {parts.join(' and ')} into your account?</p>
          <p className="mt-1 max-w-[64ch] text-body-2-regular text-text-secondary text-pretty">
            Found on this browser from an earlier version. Importing saves them to your account
            {plan.zoneCount > 0 && plan.missions.length > 0 ? ' (zones are added to each imported mission)' : ''}; then the local copy is removed.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-body-2-regular text-fd-danger">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 gap-2 ps-[30px] sm:ps-0">
        <Button
          variant="ghost"
          size="small"
          onClick={() => {
            discardLegacyLocalData();
            setHidden(true);
          }}
          disabled={busy}
        >
          Discard
        </Button>
        <Button variant="secondary" size="small" onClick={() => setHidden(true)} disabled={busy}>
          Not now
        </Button>
        <Button variant="secondary" size="small" onClick={doImport} disabled={busy}>
          {busy ? 'Importing…' : 'Import'}
        </Button>
      </div>
    </div>
  );
}
