'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, LogOut, MapPin, Plus, Copy, Trash2, AlertTriangle } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { LegacyImportPrompt } from '@/components/common/legacy-import-prompt';
import { signOut } from '@/lib/store/local-data';

interface MissionSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  waypointCount: number;
}

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

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

function VerificationBanner({ onResend }: { onResend: () => void }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    setSending(true);
    await onResend();
    setSending(false);
    setSent(true);
  };

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2 rounded-md border border-amber/40 bg-amber-bg px-3.5 py-2.5">
      <AlertTriangle size={14} className="shrink-0 text-amber" />
      <span className="flex-1 font-sans text-[12.5px] text-amber">
        {sent ? 'Verification email sent — check your inbox.' : 'Verify your email address to secure your account.'}
      </span>
      {!sent && (
        <Button size="sm" onClick={handleResend} disabled={sending} className="border-amber bg-transparent text-amber hover:bg-amber/20">
          {sending ? <Spinner size={12} className="text-amber" /> : 'Resend email'}
        </Button>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  mission: MissionSummary;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState<'duplicate' | null>(null);

  return (
    <Card className="flex flex-col gap-3 p-4 transition-colors hover:border-border-hi">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="truncate font-sans text-[14px] font-semibold text-text hover:text-green">{mission.name}</div>
          <div className="mt-0.5 font-mono text-[10px] text-text-muted">Updated {relativeTime(mission.updatedAt)}</div>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            icon={busy === 'duplicate' ? <Spinner size={12} /> : <Copy size={13} />}
            aria-label={`Duplicate ${mission.name}`}
            size="sm"
            disabled={busy !== null}
            onClick={async () => {
              setBusy('duplicate');
              await onDuplicate();
              setBusy(null);
            }}
          />
          <IconButton
            icon={<Trash2 size={13} />}
            aria-label={`Delete ${mission.name}`}
            size="sm"
            onClick={onDelete}
            className="hover:bg-red-bg hover:text-red"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="neutral">{mission.waypointCount} waypoint{mission.waypointCount === 1 ? '' : 's'}</Badge>
      </div>
      <Button variant="outline" size="sm" onClick={onOpen} className="mt-1 justify-center">
        Open
      </Button>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [missions, setMissions] = useState<MissionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MissionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [meRes, missionsRes] = await Promise.all([fetch('/api/auth/me'), fetch('/api/missions')]);
      if (meRes.ok) {
        const meData = await meRes.json();
        setUser(meData.user);
      }
      if (!missionsRes.ok) {
        setError('Could not load your missions.');
        setMissions([]);
        return;
      }
      const data = await missionsRes.json();
      setMissions(data.missions);
    } catch {
      setError('Could not reach the server.');
      setMissions([]);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Mission' }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        router.push(`/missions/${data.mission.id}`);
        return;
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (mission: MissionSummary) => {
    const res = await fetch(`/api/missions/${mission.id}/duplicate`, { method: 'POST' });
    if (res.ok) {
      await loadAll();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/missions/${deleteTarget.id}`, { method: 'DELETE' });
      if (res.ok) {
        setMissions((prev) => (prev ? prev.filter((m) => m.id !== deleteTarget.id) : prev));
      }
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleLogout = () => signOut('/');

  const handleResendVerification = async () => {
    await fetch('/api/auth/resend-verification', { method: 'POST' });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Bot size={14} className="text-primary-foreground" />
            </div>
            <span className="font-sans text-[15px] font-bold text-foreground">Flight Deck</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden font-sans text-[12.5px] text-muted-foreground sm:inline">
                {user.name || user.email}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
              <LogOut size={12} /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 sm:px-8">
        {user && !user.emailVerified && <VerificationBanner onResend={handleResendVerification} />}
        <LegacyImportPrompt serverMissions={error ? null : missions} onImported={loadAll} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-sans text-xl font-bold text-foreground">Missions</h1>
            <p className="mt-0.5 font-sans text-[13px] text-muted-foreground">
              Create, edit, and export ArduPilot-compatible flight plans.
            </p>
          </div>
          <Button variant="primary" onClick={handleCreate} disabled={creating} className="gap-1.5 font-sans">
            {creating ? <Spinner size={14} className="text-background" /> : <Plus size={14} />}
            New mission
          </Button>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-red/40 bg-red-bg px-3.5 py-2.5 font-sans text-[12.5px] text-red">
            {error}
          </div>
        )}

        {missions === null ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size={20} />
          </div>
        ) : missions.length === 0 ? (
          <Card className="py-4">
            <EmptyState
              icon={MapPin}
              title="No missions yet"
              description="Create your first mission to start planning a flight."
              action={
                <Button variant="primary" size="sm" onClick={handleCreate} disabled={creating} className="mt-2 font-sans">
                  <Plus size={13} /> New mission
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {missions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                onOpen={() => router.push(`/missions/${mission.id}`)}
                onDuplicate={() => handleDuplicate(mission)}
                onDelete={() => setDeleteTarget(mission)}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm" className="border-red/40">
        <DialogBody>
          <div className="mb-1.5 font-mono text-[13px] font-bold text-text">Delete mission?</div>
          <p className="font-sans text-xs text-text-muted">
            {deleteTarget ? `"${deleteTarget.name}" ` : ''}and all of its waypoints will be permanently removed.
            This cannot be undone.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={confirmDelete}
            disabled={deleting}
            className="border-red bg-red-bg font-mono font-bold text-red hover:bg-red/20"
          >
            {deleting ? <Spinner size={12} className="text-red" /> : 'Delete'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
