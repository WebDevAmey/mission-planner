'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { RiComputerLine, RiErrorWarningLine, RiLogoutBoxRLine, RiMailCheckLine, RiSmartphoneLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { AppShell } from '@/components/app-shell/app-shell';
import { AppDialog } from '@/components/app-shell/app-dialog';
import { SkeletonBlock } from '@/components/common/skeleton-loader';
import { ToastItem, ToastStack } from '@/components/common/toast';
import { clearLocalMissionData } from '@/lib/store/local-data';
import { cx } from '@/utils/cx';

interface Profile {
  id: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
  createdAt: string;
}

interface SessionRow {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
}

interface Toast {
  id: number;
  status: 'success' | 'error' | 'information';
  title: string;
  description?: string;
}

interface ApiFailure {
  ok: false;
  error: string;
  code?: string;
  issues?: { path: string; message: string }[];
}

async function api<T>(url: string, init?: RequestInit): Promise<({ ok: true } & T) | ApiFailure> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      return { ok: false, error: data?.error ?? `Request failed (${res.status})`, code: data?.code, issues: data?.issues };
    }
    return data;
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' };
  }
}

function describeDevice(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Unknown device', mobile: false };
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  const browser =
    /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Mac OS X/.test(ua) && !mobile
      ? 'macOS'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Unknown OS';
  return { label: `${browser} on ${os}`, mobile };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** One settings section: title-3 heading and a one-line description above its content.
 * Sections are separated by hairlines, not cards. */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`section-${id}`} className="flex flex-col gap-5 border-t border-separator-border py-8 first:border-t-0 first:pt-0">
      <header className="flex flex-col gap-1">
        <h2 id={`section-${id}`} className="text-title-3-medium text-text-primary">
          {title}
        </h2>
        <p className="max-w-[64ch] text-body-2-regular text-text-secondary text-pretty">{description}</p>
      </header>
      {children}
    </section>
  );
}

function Dot({ tone }: { tone: 'ok' | 'warn' }) {
  return <span aria-hidden className={cx('size-1.5 shrink-0 rounded-full', tone === 'ok' ? 'bg-fd-ok' : 'bg-fd-warn')} />;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [resending, setResending] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<{ field: string; message: string } | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  const [revoking, setRevoking] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list, { ...t, id }]);
    window.setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 5000);
  }, []);

  const loadSessions = useCallback(async () => {
    const res = await api<{ sessions: SessionRow[] }>('/api/account/sessions');
    if (res.ok) setSessions(res.sessions);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await api<{ user: Profile }>('/api/account');
      if (cancelled) return;
      if (!res.ok) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- session is gone; reload drops in-memory state
        if (res.code === 'UNAUTHORIZED') window.location.assign('/login?next=/settings');
        else setLoadError(res.error);
        return;
      }
      setProfile(res.user);
      setName(res.user.name ?? '');
      await loadSessions();
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSessions]);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setSavingName(true);
    const res = await api<{ user: Profile }>('/api/account', {
      method: 'PATCH',
      body: JSON.stringify({ name: name.trim() || null }),
    });
    setSavingName(false);
    if (!res.ok) return toast({ status: 'error', title: 'Could not save name', description: res.error });
    setProfile(res.user);
    toast({ status: 'success', title: 'Name updated' });
  }

  async function resendVerification() {
    setResending(true);
    const res = await api<{ alreadyVerified?: boolean; emailDelivered?: boolean; devVerifyUrl?: string }>(
      '/api/auth/resend-verification',
      { method: 'POST' }
    );
    setResending(false);
    if (!res.ok) return toast({ status: 'error', title: 'Could not send email', description: res.error });
    if (res.alreadyVerified) {
      setProfile((p) => (p ? { ...p, emailVerified: true } : p));
      return toast({ status: 'information', title: 'Email already verified' });
    }
    toast({
      status: res.emailDelivered ? 'success' : 'information',
      title: res.emailDelivered ? 'Verification email sent' : 'Email delivery is not configured',
      description: res.devVerifyUrl ? `Dev link: ${res.devVerifyUrl}` : 'Check your inbox for the link.',
    });
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 10) {
      return setPasswordError({ field: 'newPassword', message: 'Use at least 10 characters' });
    }
    if (newPassword !== confirmPassword) {
      return setPasswordError({ field: 'confirmPassword', message: 'Passwords do not match' });
    }
    setChangingPassword(true);
    const res = await api('/api/account/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setChangingPassword(false);
    if (!res.ok) {
      const issue = res.issues?.[0];
      setPasswordError({ field: issue?.path ?? 'currentPassword', message: issue?.message ?? res.error });
      return toast({ status: 'error', title: 'Password not changed', description: res.error });
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    toast({ status: 'success', title: 'Password changed', description: 'All other devices have been signed out.' });
    await loadSessions();
  }

  async function revoke(target: { id?: string; scope?: 'others' | 'all' }) {
    const key = target.id ?? target.scope ?? 'others';
    setRevoking(key);
    const qs = target.id ? `id=${encodeURIComponent(target.id)}` : `scope=${target.scope ?? 'others'}`;
    const res = await api<{ revoked: number; signedOut: boolean }>(`/api/account/sessions?${qs}`, { method: 'DELETE' });
    setRevoking(null);
    if (!res.ok) return toast({ status: 'error', title: 'Could not sign out', description: res.error });
    if (res.signedOut) {
      clearLocalMissionData();
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- signed out; reload drops in-memory state
      window.location.assign('/login');
      return;
    }
    toast({
      status: 'success',
      title: target.id ? 'Session signed out' : `Signed out ${res.revoked} other ${res.revoked === 1 ? 'session' : 'sessions'}`,
    });
    await loadSessions();
  }

  async function deleteAccount() {
    setDeleteError(null);
    setDeleting(true);
    const res = await api('/api/account', { method: 'DELETE', body: JSON.stringify({ password: deletePassword }) });
    setDeleting(false);
    if (!res.ok) return setDeleteError(res.error);
    clearLocalMissionData();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- account deleted; reload drops in-memory state
    window.location.assign('/?accountDeleted=1');
  }

  const otherSessions = sessions?.filter((s) => !s.current).length ?? 0;

  const closeDelete = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeletePassword('');
    setDeleteConfirm('');
    setDeleteError(null);
  };

  return (
    <AppShell user={profile ? { name: profile.name, email: profile.email } : null}>
      <main id="main" className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-20 sm:px-6 sm:pt-10">
        <h1 className="mb-8 text-title-1-medium text-text-primary">Settings</h1>

        {loadError && (
          <div role="alert" className="mb-8 flex items-center gap-3 rounded-fd-control border border-fd-danger/40 bg-background-primary-default px-4 py-3">
            <RiErrorWarningLine className="size-[18px] shrink-0 text-fd-danger" aria-hidden />
            <p className="min-w-0 flex-1 text-body-2-regular text-text-primary">{loadError}</p>
            <Button size="small" variant="secondary" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        )}

        {!profile && !loadError ? (
          <div aria-busy="true" aria-label="Loading settings">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-4 border-t border-separator-border py-8 first:border-t-0 first:pt-0">
                <SkeletonBlock className="h-5 w-32" />
                <SkeletonBlock className="h-3.5 w-72 max-w-full" />
                <SkeletonBlock className="h-9 w-full rounded-fd-control" />
              </div>
            ))}
          </div>
        ) : profile ? (
          <div>
            <Section id="profile" title="Profile" description="Your name is shown in the account menu. Your email is how you sign in.">
              <form onSubmit={saveName} className="flex flex-col gap-5">
                <Input label="Name" value={name} onChange={setName} maxLength={120} placeholder="Your name" />
                <div className="flex flex-col gap-1.5">
                  <span className="text-body-2-medium text-text-primary">Email</span>
                  <div className="flex flex-col gap-2 rounded-fd-control border border-separator-border bg-background-secondary-default px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="min-w-0 truncate text-body-2-regular text-text-primary">{profile.email}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      {profile.emailVerified ? (
                        <span className="inline-flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
                          <Dot tone="ok" />
                          Verified
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 text-caption-1-medium text-text-secondary">
                            <Dot tone="warn" />
                            Not verified
                          </span>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            leadingIcon={RiMailCheckLine}
                            onClick={resendVerification}
                            disabled={resending}
                          >
                            {resending ? 'Sending…' : 'Resend link'}
                          </Button>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" size="small" disabled={savingName || name.trim() === (profile.name ?? '')}>
                    {savingName ? 'Saving…' : 'Save name'}
                  </Button>
                </div>
              </form>
            </Section>

            <Section id="password" title="Password" description="Changing your password signs out every other device.">
              <form onSubmit={changePassword} className="flex flex-col gap-4">
                <Input
                  label="Current password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  isRequired
                  isInvalid={passwordError?.field === 'currentPassword'}
                  hint={passwordError?.field === 'currentPassword' ? passwordError.message : undefined}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={setNewPassword}
                    isRequired
                    isInvalid={passwordError?.field === 'newPassword'}
                    hint={passwordError?.field === 'newPassword' ? passwordError.message : 'At least 10 characters'}
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    isRequired
                    isInvalid={passwordError?.field === 'confirmPassword'}
                    hint={passwordError?.field === 'confirmPassword' ? passwordError.message : undefined}
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="secondary" size="small" disabled={changingPassword || !currentPassword || !newPassword}>
                    {changingPassword ? 'Changing…' : 'Change password'}
                  </Button>
                </div>
              </form>
            </Section>

            <Section id="sessions" title="Sessions" description="Devices signed in to your account.">
              {sessions === null ? (
                <SkeletonBlock className="h-16 w-full rounded-fd-control" />
              ) : (
                <ul className="divide-y divide-separator-border overflow-hidden rounded-fd-control border border-separator-border bg-background-primary-default">
                  {sessions.map((s) => {
                    const device = describeDevice(s.userAgent);
                    const DeviceIcon = device.mobile ? RiSmartphoneLine : RiComputerLine;
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <DeviceIcon className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 text-body-2-medium text-text-primary">
                            {device.label}
                            {s.current && <span className="text-caption-1-medium text-text-tertiary">This device</span>}
                          </p>
                          <p className="text-caption-1-regular tabular-nums text-text-secondary">
                            Signed in {formatDate(s.createdAt)}
                            {s.lastSeenAt ? ` · Active ${formatDate(s.lastSeenAt)}` : ''}
                            {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                          </p>
                        </div>
                        {!s.current && (
                          <Button variant="ghost" size="xs" onClick={() => revoke({ id: s.id })} disabled={revoking !== null}>
                            {revoking === s.id ? 'Signing out…' : 'Sign out'}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" size="small" onClick={() => revoke({ scope: 'others' })} disabled={revoking !== null || otherSessions === 0}>
                  {revoking === 'others' ? 'Signing out…' : 'Sign out other devices'}
                </Button>
                <Button variant="secondary" size="small" leadingIcon={RiLogoutBoxRLine} onClick={() => revoke({ scope: 'all' })} disabled={revoking !== null}>
                  Sign out everywhere
                </Button>
              </div>
            </Section>

            <Section id="danger" title="Danger zone" description="Actions here cannot be undone.">
              <div className="flex flex-col gap-4 rounded-fd-control border border-fd-danger/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-body-2-medium text-text-primary">Delete account</p>
                  <p className="mt-0.5 text-body-2-regular text-text-secondary text-pretty">
                    Permanently deletes your account and every mission, waypoint and zone in it.
                  </p>
                </div>
                <Button variant="danger" size="small" className="shrink-0 self-start sm:self-center" onClick={() => setDeleteOpen(true)}>
                  Delete account…
                </Button>
              </div>
            </Section>
          </div>
        ) : null}
      </main>

      <AppDialog
        open={deleteOpen}
        onClose={closeDelete}
        busy={deleting}
        size="md"
        tone="danger"
        title="Delete your account?"
        description={
          <>
            All missions and settings for <span className="text-text-primary">{profile?.email}</span> are deleted immediately. You
            will be signed out on every device.
          </>
        }
        onSubmit={() => void deleteAccount()}
        footer={
          <>
            <Button type="button" variant="secondary" size="small" onClick={closeDelete} disabled={deleting}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" size="small" disabled={deleting || !deletePassword || deleteConfirm !== 'DELETE'}>
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </>
        }
      >
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          value={deletePassword}
          onChange={setDeletePassword}
          isRequired
          isInvalid={Boolean(deleteError)}
          hint={deleteError ?? undefined}
        />
        <Input label='Type "DELETE" to confirm' value={deleteConfirm} onChange={setDeleteConfirm} autoComplete="off" isRequired />
      </AppDialog>

      <ToastStack>
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            tone={t.status === 'information' ? 'info' : t.status}
            title={t.title}
            description={t.description}
            onDismiss={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
          />
        ))}
      </ToastStack>
    </AppShell>
  );
}
