'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiAddLine,
  RiErrorWarningLine,
  RiLogoutBoxRLine,
  RiMailLine,
  RiRefreshLine,
  RiRouteLine,
  RiSearchLine,
  RiSettings3Line,
  RiUpload2Line,
} from '@remixicon/react';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { SelectField } from '@/components/editor/fields';
import { ToastContainer } from '@/components/common/toast';
import { LegacyImportPrompt } from '@/components/common/legacy-import-prompt';
import { ExportAnywayDialog } from '@/components/editor/export/export-menu';
import type { ExportFormatInfo } from '@/components/editor/export/exporters';
import { MissionCard, MissionCardSkeleton, type CardAction } from '@/components/dashboard/mission-card';
import { DeleteDialog, ExportDialog, NewMissionDialog, RenameDialog, type NewMissionInput } from '@/components/dashboard/dashboard-dialogs';
import { serverExport } from '@/components/dashboard/server-export';
import type { MissionSummary } from '@/components/dashboard/types';
import type { Issue } from '@/lib/domain/validate';
import { useUIStore } from '@/lib/store/ui-store';
import { signOut } from '@/lib/store/local-data';

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
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2lg border border-separator-border bg-background-secondary-default px-4 py-3">
      <RiMailLine className="size-5 shrink-0 text-amber" aria-hidden />
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

  return (
    <div className="min-h-dvh bg-background-primary-default text-text-primary">
      <header className="sticky top-0 z-20 border-b border-separator-border bg-background-primary-default">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent-600 text-white">
              <RiRouteLine className="size-[18px]" aria-hidden />
            </span>
            <span className="text-body-semibold text-text-primary">Flight Deck</span>
          </span>
          <div className="flex-1" />
          {user && <span className="hidden truncate text-body-2-regular text-text-secondary sm:inline">{user.name || user.email}</span>}
          <ButtonLink href="/settings" size="small" variant="ghost" leadingIcon={RiSettings3Line}>
            <span className="hidden sm:inline">Settings</span>
          </ButtonLink>
          <Button size="small" variant="ghost" leadingIcon={RiLogoutBoxRLine} onClick={() => void signOut('/')}>
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
        {user && !user.emailVerified && <VerificationBanner />}
        <LegacyImportPrompt serverMissions={error ? null : missions} onImported={loadAll} />

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-headline-semibold text-text-primary">Missions</h1>
            <p className="text-body-2-regular text-text-secondary">Plan, check and export ArduPilot and PX4 missions.</p>
          </div>
          <div className="flex gap-2">
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
            <Button size="medium" variant="secondary" leadingIcon={RiUpload2Line} disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? 'Importing…' : 'Import file'}
            </Button>
            <Button size="medium" variant="primary" leadingIcon={RiAddLine} onClick={() => setNewOpen(true)}>
              New mission
            </Button>
          </div>
        </div>

        {missions && missions.length > 0 && (
          <div className="flex flex-wrap items-end gap-3">
            <Input
              aria-label="Search missions"
              placeholder="Search missions"
              leadingIcon={RiSearchLine}
              value={query}
              onChange={setQuery}
              className="w-full sm:w-72"
            />
            <SelectField label="Sort by" value={sort} options={SORTS} onChange={setSort} className="w-48" />
          </div>
        )}

        {error && (
          <div role="alert" className="flex items-center gap-3 rounded-2lg border border-red bg-red-bg px-4 py-3">
            <RiErrorWarningLine className="size-5 shrink-0 text-red" aria-hidden />
            <p className="flex-1 text-body-2-regular text-text-primary">{error}</p>
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

        {shown === null ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading missions">
            {Array.from({ length: 6 }, (_, i) => (
              <MissionCardSkeleton key={i} />
            ))}
          </div>
        ) : missions!.length === 0 && !error ? (
          <div className="flex flex-col items-center gap-4 rounded-2lg border border-dashed border-separator-border px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-background-secondary-default">
              <RiRouteLine className="size-6 text-text-secondary" aria-hidden />
            </span>
            <div className="flex flex-col gap-1">
              <h2 className="text-body-semibold text-text-primary">No missions yet</h2>
              <p className="max-w-sm text-body-2-regular text-text-secondary">
                Create a mission from a template, or import a .plan, .waypoints or Flight Deck file.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="small" variant="secondary" leadingIcon={RiUpload2Line} onClick={() => fileRef.current?.click()}>
                Import file
              </Button>
              <Button size="small" variant="primary" leadingIcon={RiAddLine} onClick={() => setNewOpen(true)}>
                New mission
              </Button>
            </div>
          </div>
        ) : shown.length === 0 && missions!.length > 0 ? (
          <p className="py-12 text-center text-body-2-regular text-text-secondary">No missions match “{query}”.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </div>
  );
}
