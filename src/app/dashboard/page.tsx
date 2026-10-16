'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiAddLine,
  RiErrorWarningLine,
  RiGridLine,
  RiListCheck,
  RiMailLine,
  RiRefreshLine,
  RiSearchLine,
  RiUpload2Line,
} from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '@/components/base/select/select';
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control';
import { AppShell } from '@/components/app-shell/app-shell';
import { ToastContainer } from '@/components/common/toast';
import { LegacyImportPrompt } from '@/components/common/legacy-import-prompt';
import { ExportAnywayDialog } from '@/components/editor/export/export-menu';
import type { ExportFormatInfo } from '@/components/editor/export/exporters';
import { MissionCard, MissionCardSkeleton, type CardAction } from '@/components/dashboard/mission-card';
import { MissionTable, MissionTableSkeleton } from '@/components/dashboard/mission-table';
import { EmptyRouteFigure } from '@/components/dashboard/empty-route-figure';
import { DeleteDialog, ExportDialog, NewMissionDialog, RenameDialog, type NewMissionInput } from '@/components/dashboard/dashboard-dialogs';
import { serverExport } from '@/components/dashboard/server-export';
import type { MissionSummary } from '@/components/dashboard/types';
import type { Issue } from '@/lib/domain/validate';
import { useUIStore } from '@/lib/store/ui-store';

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

type Sort = 'updated' | 'name' | 'created';
const SORTS: { value: Sort; label: string }[] = [
  { value: 'updated', label: 'Recently edited' },
  { value: 'created', label: 'Newest' },
  { value: 'name', label: 'Name' },
];

/* View toggle (grid / table), remembered per browser. Read through
 * useSyncExternalStore so the server render and hydration both use 'grid'. */
type View = 'grid' | 'table';
const VIEW_KEY = 'fd:dashboard-view';
const VIEW_EVENT = 'fd:dashboard-view-change';

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

function subscribeView(onChange: () => void) {
  window.addEventListener(VIEW_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(VIEW_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function writeView(view: View) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage blocked: the toggle still works for this page view.
  }
  window.dispatchEvent(new Event(VIEW_EVENT));
}

async function errorOf(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

function VerificationBanner() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const resend = async () => {
    setState('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST' });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };
  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-md border border-separator-border bg-background-primary-default px-4 py-3">
      <RiMailLine className="size-[18px] shrink-0 text-(color:--fd-warn)" aria-hidden />
      <p className="min-w-0 flex-1 text-body-2-regular text-text-primary">
        {state === 'sent'
          ? 'Verification email sent. Check your inbox.'
          : state === 'error'
            ? 'Could not send the email. Try again in a few minutes.'
            : 'Verify your email address to secure your account.'}
      </p>
      {state !== 'sent' && (
        <Button size="small" variant="secondary" disabled={state === 'sending'} onClick={() => void resend()}>
          {state === 'sending' ? 'Sending…' : 'Resend email'}
        </Button>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const addToast = useUIStore((s) => s.addToast);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [missions, setMissions] = useState<MissionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('updated');
  const storedView = useSyncExternalStore(subscribeView, readView, () => 'grid' as View);
  const [view, setViewState] = useState<View | null>(null);
  const activeView = view ?? storedView;
  const setView = (v: View) => {
    setViewState(v);
    writeView(v);
  };

  const [newOpen, setNewOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renameTarget, setRenameTarget] = useState<MissionSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MissionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exportTarget, setExportTarget] = useState<MissionSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [forceExport, setForceExport] = useState<{ mission: MissionSummary; format: ExportFormatInfo; issues: Issue[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadAll = useCallback(async () => {
    try {
      const [meRes, missionsRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/missions')]);
      if (meRes.status === 401 || missionsRes.status === 401) {
        router.replace('/login?next=/dashboard');
        return;
      }
      if (meRes.ok) setUser((await meRes.json()).user);
      if (!missionsRes.ok) {
        setError(await errorOf(missionsRes, 'Could not load your missions.'));
        setMissions([]);
        return;
      }
      setError(null);
      setMissions((await missionsRes.json()).missions);
      // "New mission" from the command palette on another page lands here with ?new=1.
      if (new URLSearchParams(window.location.search).get('new') === '1') {
        setNewOpen(true);
        router.replace('/dashboard');
      }
    } catch {
      setError('Could not reach the server. Check your connection.');
      setMissions([]);
    }
  }, [router]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const shown = useMemo(() => {
    if (!missions) return null;
    const q = query.trim().toLowerCase();
    const list = q ? missions.filter((m) => m.name.toLowerCase().includes(q) || m.description?.toLowerCase().includes(q)) : [...missions];
    list.sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name)
        : sort === 'created'
          ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt)
    );
    return list;
  }, [missions, query, sort]);

  /* --------------------------------------------------------- actions */

  const create = async (input: NewMissionInput) => {
    setCreating(true);
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(input.name && { name: input.name }),
          ...(input.template !== 'blank' && { template: input.template }),
          ...(input.home && { home: input.home }),
        }),
      });
      if (!res.ok) throw new Error(await errorOf(res, 'Could not create the mission'));
      const data = await res.json();
      router.push(`/missions/${data.mission.id}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not create the mission', 'error');
      setCreating(false);
    }
  };

  const duplicate = async (m: MissionSummary) => {
    try {
      const res = await fetch(`/api/missions/${m.id}/duplicate`, { method: 'POST' });
      if (!res.ok) throw new Error(await errorOf(res, 'Could not duplicate the mission'));
      addToast(`Duplicated “${m.name}”`, 'success');
      await loadAll();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not duplicate the mission', 'error');
    }
  };

  const rename = async (m: MissionSummary, name: string) => {
    setRenameTarget(null);
    const prev = missions;
    setMissions((list) => list?.map((x) => (x.id === m.id ? { ...x, name } : x)) ?? list);
    try {
      const res = await fetch(`/api/missions/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await errorOf(res, 'Could not rename the mission'));
    } catch (err) {
      setMissions(prev);
      addToast(err instanceof Error ? err.message : 'Could not rename the mission', 'error');
    }
  };

  const remove = async (m: MissionSummary) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/missions/${m.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await errorOf(res, 'Could not delete the mission'));
      setMissions((list) => list?.filter((x) => x.id !== m.id) ?? list);
      addToast(`Deleted “${m.name}”`, 'info');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not delete the mission', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const doExport = async (m: MissionSummary, f: ExportFormatInfo, force = false) => {
    setExporting(true);
    const r = await serverExport(m.id, f.id, force);
    setExporting(false);
    if (r.ok) {
      setExportTarget(null);
      addToast(`Downloaded ${r.filename}`, 'success');
    } else if ('issues' in r) {
      setExportTarget(null);
      setForceExport({ mission: m, format: f, issues: r.issues });
    } else {
      addToast(r.error, 'error');
    }
  };

  const importFile = async (file: File) => {
    if (file.size > 1024 * 1024) {
      addToast('That file is larger than 1 MB', 'error');
      return;
    }
    setImporting(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/missions/import', { method: 'POST', body });
      if (!res.ok) throw new Error(await errorOf(res, `Could not import ${file.name}`));
      const data = (await res.json()) as { mission: { id: string; name: string }; warnings?: string[] };
      const warn = data.warnings?.length ? ` with ${data.warnings.length} warning${data.warnings.length === 1 ? '' : 's'}` : '';
      addToast(`Imported “${data.mission.name}”${warn}`, data.warnings?.length ? 'warning' : 'success', {
        label: 'Open',
        onClick: () => router.push(`/missions/${data.mission.id}`),
      });
      await loadAll();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const onAction = (a: CardAction, m: MissionSummary) => {
    if (a === 'rename') setRenameTarget(m);
    else if (a === 'duplicate') void duplicate(m);
    else if (a === 'export') setExportTarget(m);
    else setDeleteTarget(m);
  };

  /* --------------------------------------------------------- render */

  const openImport = () => fileRef.current?.click();
  const empty = missions !== null && missions.length === 0 && !error;
  const loading = shown === null;

  return (
    <AppShell
      user={user}
      missions={missions?.map((m) => ({ id: m.id, name: m.name })) ?? null}
      onNewMission={() => setNewOpen(true)}
      onImport={openImport}
    >
      <input
        ref={fileRef}
        type="file"
        accept=".plan,.waypoints,.json,.txt"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importFile(f);
        }}
      />
      <main id="main" className="mx-auto flex max-w-[1280px] flex-col gap-6 px-4 pt-8 pb-16 sm:px-6 sm:pt-10">
        {user && !user.emailVerified && <VerificationBanner />}
        <LegacyImportPrompt serverMissions={error ? null : missions} onImported={loadAll} />

        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <h1 className="flex items-baseline gap-2.5 text-title-1-medium text-text-primary">
            Missions
            {missions && missions.length > 0 && (
              <span className="text-title-3-regular tabular-nums text-text-tertiary">
                <span className="sr-only">(</span>
                {missions.length}
                <span className="sr-only">)</span>
              </span>
            )}
          </h1>
          {!empty && (
            <div className="flex gap-2">
              <Button size="small" variant="secondary" leadingIcon={RiUpload2Line} disabled={importing} onClick={openImport}>
                {importing ? 'Importing…' : 'Import'}
              </Button>
              <Button size="small" variant="primary" leadingIcon={RiAddLine} onClick={() => setNewOpen(true)}>
                New mission
              </Button>
            </div>
          )}
        </div>

        {missions && missions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-separator-border pb-4">
            <Input
              aria-label="Search missions"
              placeholder="Search missions"
              leadingIcon={RiSearchLine}
              value={query}
              onChange={setQuery}
              className="w-full sm:w-64"
            />
            <Select
              aria-label="Sort missions"
              size="sm"
              selectedKey={sort}
              onSelectionChange={(k) => {
                const opt = SORTS.find((o) => o.value === k);
                if (opt) setSort(opt.value);
              }}
              triggerClassName="h-9 min-w-[168px]"
            >
              {SORTS.map((o) => (
                <SelectItem key={o.value} id={o.value} textValue={o.label}>
                  {o.label}
                </SelectItem>
              ))}
            </Select>
            <div className="flex-1" />
            <SegmentedControl
              aria-label="View"
              selectedKeys={new Set([activeView])}
              onSelectionChange={(keys) => {
                const v = [...keys][0];
                if (v === 'grid' || v === 'table') setView(v);
              }}
            >
              <SegmentedControlItem id="grid" aria-label="Grid view" className="gap-1.5 text-body-2-medium!">
                <RiGridLine className="size-4" aria-hidden />
                <span className="hidden sm:inline">Grid</span>
              </SegmentedControlItem>
              <SegmentedControlItem id="table" aria-label="Table view" className="gap-1.5 text-body-2-medium!">
                <RiListCheck className="size-4" aria-hidden />
                <span className="hidden sm:inline">Table</span>
              </SegmentedControlItem>
            </SegmentedControl>
          </div>
        )}

        {error && (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-(color:--fd-danger)/40 bg-background-primary-default px-4 py-3">
            <RiErrorWarningLine className="size-[18px] shrink-0 text-(color:--fd-danger)" aria-hidden />
            <p className="min-w-0 flex-1 text-body-2-regular text-text-primary">{error}</p>
            <Button
              size="small"
              variant="secondary"
              leadingIcon={RiRefreshLine}
              onClick={() => {
                setMissions(null);
                void loadAll();
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <div aria-busy="true" aria-label="Loading missions">
            {activeView === 'table' ? (
              <MissionTableSkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <MissionCardSkeleton key={i} />
                ))}
              </div>
            )}
          </div>
        ) : empty ? (
          <section
            aria-labelledby="empty-title"
            className="flex flex-col items-start gap-6 rounded-md border border-separator-border bg-background-primary-default p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-10"
          >
            <EmptyRouteFigure className="w-full max-w-[280px] shrink-0 sm:w-[240px]" />
            <div className="flex max-w-[44ch] flex-col items-start gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 id="empty-title" className="text-title-3-medium text-text-primary">
                  No missions yet
                </h2>
                <p className="text-body-2-regular text-text-secondary text-pretty">
                  Start a mission and place waypoints on the map, begin from a survey or orbit template, or import a
                  .plan or .waypoints file from QGroundControl or Mission Planner.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="small" variant="primary" leadingIcon={RiAddLine} onClick={() => setNewOpen(true)}>
                  New mission
                </Button>
                <Button size="small" variant="secondary" leadingIcon={RiUpload2Line} disabled={importing} onClick={openImport}>
                  {importing ? 'Importing…' : 'Import a .plan file'}
                </Button>
              </div>
            </div>
          </section>
        ) : shown.length === 0 && missions!.length > 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-body-2-regular text-text-secondary">No missions match “{query}”.</p>
            <Button size="small" variant="ghost" onClick={() => setQuery('')}>
              Clear search
            </Button>
          </div>
        ) : shown.length === 0 ? null : activeView === 'table' ? (
          <MissionTable missions={shown} onAction={onAction} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((m) => (
              <MissionCard key={m.id} mission={m} onAction={onAction} />
            ))}
          </div>
        )}
      </main>

      {newOpen && <NewMissionDialog open busy={creating} onClose={() => setNewOpen(false)} onCreate={(i) => void create(i)} />}
      <RenameDialog key={renameTarget?.id ?? 'none'} mission={renameTarget} onClose={() => setRenameTarget(null)} onRename={(m, n) => void rename(m, n)} />
      <DeleteDialog mission={deleteTarget} busy={deleting} onClose={() => setDeleteTarget(null)} onConfirm={(m) => void remove(m)} />
      <ExportDialog mission={exportTarget} busy={exporting} onClose={() => setExportTarget(null)} onPick={(m, f) => void doExport(m, f)} />
      <ExportAnywayDialog
        open={!!forceExport}
        issues={forceExport?.issues ?? []}
        onCancel={() => setForceExport(null)}
        onConfirm={() => {
          const f = forceExport;
          setForceExport(null);
          if (f) void doExport(f.mission, f.format, true);
        }}
      />
      <ToastContainer />
    </AppShell>
  );
}
