'use client';

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  RiArrowLeftLine,
  RiComputerLine,
  RiDeleteBinLine,
  RiLockPasswordLine,
  RiLogoutBoxRLine,
  RiMailCheckLine,
  RiSmartphoneLine,
  RiUserLine,
} from '@remixicon/react';
import { Button, ButtonLink } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { Chip } from '@/components/base/badges/chip';
import { Notification, NotificationViewport } from '@/components/base/notification/notification';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { clearLocalMissionData, signOut } from '@/lib/store/local-data';

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

function Section({
  icon: Icon,
  title,
  description,
  children,
  tone = 'default',
}: {
  icon: typeof RiUserLine;
  title: string;
  description: string;
  children: ReactNode;
  tone?: 'default' | 'danger';
}) {
  return (
    <section
      aria-labelledby={`section-${title}`}
      className={
        tone === 'danger'
          ? 'rounded-xl border border-border-error-default bg-background-secondary-default p-5 sm:p-6'
          : 'rounded-xl border border-separator-border bg-background-secondary-default p-5 sm:p-6'
      }
    >
      <header className="mb-5 flex items-start gap-3">
        <span
          className={
            tone === 'danger'
              ? 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary-error text-foreground-icon-error'
              : 'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary-default text-foreground-icon-secondary'
          }
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id={`section-${title}`} className="text-headline-semibold text-text-primary">
            {title}
          </h2>
          <p className="mt-1 text-body-2-regular text-text-secondary">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
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
    setToasts((list) => [...list, { ...t, id: Date.now() + Math.random() }]);
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
      window.location.assign('/login');
      return;
    }
    toast({
      status: 'success',
      title: target.id ? 'Session signed out' : `Signed out ${res.revoked} other ${res.revoked === 1 ? 'session' : 'sessions'}`,
    });
    await loadSessions();
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    const res = await api('/api/account', { method: 'DELETE', body: JSON.stringify({ password: deletePassword }) });
    setDeleting(false);
    if (!res.ok) return setDeleteError(res.error);
    clearLocalMissionData();
    window.location.assign('/?accountDeleted=1');
  }

  const otherSessions = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <div className="min-h-dvh bg-background-full text-text-primary">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <ButtonLink href="/dashboard" variant="ghost" size="small" leadingIcon={RiArrowLeftLine} className="-ml-2 mb-3">
              Missions
            </ButtonLink>
            <h1 className="text-title-1-semibold text-text-primary">Settings</h1>
            <p className="mt-1 text-body-regular text-text-secondary">Your profile, security and account.</p>
          </div>
          <Button variant="secondary" size="small" leadingIcon={RiLogoutBoxRLine} onClick={() => signOut('/')}>
            Sign out
          </Button>
        </div>

        {loadError && (
          <p role="alert" className="mb-6 rounded-lg bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
            {loadError}
          </p>
        )}

        {!profile && !loadError ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading settings">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-background-secondary-default" />
            ))}
          </div>
        ) : profile ? (
          <div className="space-y-6">
            <Section icon={RiUserLine} title="Profile" description="How you appear in Flight Deck.">
              <form onSubmit={saveName} className="space-y-5">
                <Input label="Name" value={name} onChange={setName} maxLength={120} placeholder="Your name" />
                <div className="flex flex-col gap-3 rounded-lg bg-background-tertiary-default px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-caption-1-medium text-text-tertiary">Email</p>
                    <p className="truncate text-body-medium text-text-primary">{profile.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {profile.emailVerified ? (
                      <Chip variant="subtle" color="lime">
                        Verified
                      </Chip>
                    ) : (
                      <>
                        <Chip variant="subtle" color="yellow">
                          Not verified
                        </Chip>
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
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="small" disabled={savingName || name.trim() === (profile.name ?? '')}>
                    {savingName ? 'Saving…' : 'Save'}
                  </Button>
                </div>
              </form>
            </Section>

            <Section
              icon={RiLockPasswordLine}
              title="Password"
              description="Changing your password signs out every other device."
            >
              <form onSubmit={changePassword} className="space-y-4">
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
                  <Button type="submit" size="small" disabled={changingPassword || !currentPassword || !newPassword}>
                    {changingPassword ? 'Changing…' : 'Change password'}
                  </Button>
                </div>
              </form>
            </Section>

            <Section icon={RiComputerLine} title="Sessions" description="Devices currently signed in to your account.">
              {sessions === null ? (
                <div className="h-16 animate-pulse rounded-lg bg-background-tertiary-default" />
              ) : (
                <ul className="divide-y divide-separator-border overflow-hidden rounded-lg border border-separator-border">
                  {sessions.map((s) => {
                    const device = describeDevice(s.userAgent);
                    const DeviceIcon = device.mobile ? RiSmartphoneLine : RiComputerLine;
                    return (
                      <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                        <DeviceIcon className="size-5 shrink-0 text-foreground-icon-tertiary" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-body-medium text-text-primary">
                            {device.label}
                            {s.current && (
                              <Chip variant="subtle" color="blue">
                                This device
                              </Chip>
                            )}
                          </p>
                          <p className="text-caption-1-regular text-text-tertiary">
                            Signed in {formatDate(s.createdAt)}
                            {s.lastSeenAt ? ` · Active ${formatDate(s.lastSeenAt)}` : ''}
                            {s.ipAddress ? ` · ${s.ipAddress}` : ''}
                          </p>
                        </div>
                        {!s.current && (
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => revoke({ id: s.id })}
                            disabled={revoking !== null}
                          >
                            {revoking === s.id ? 'Signing out…' : 'Sign out'}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => revoke({ scope: 'others' })}
                  disabled={revoking !== null || otherSessions === 0}
                >
                  {revoking === 'others' ? 'Signing out…' : 'Sign out other devices'}
                </Button>
                <Button
                  variant="secondary"
                  size="small"
                  leadingIcon={RiLogoutBoxRLine}
                  onClick={() => revoke({ scope: 'all' })}
                  disabled={revoking !== null}
                >
                  Sign out everywhere
                </Button>
              </div>
            </Section>

            <Section
              icon={RiDeleteBinLine}
              title="Delete account"
              description="Permanently delete your account and every mission, waypoint and zone in it. This cannot be undone."
              tone="danger"
            >
              <div className="flex justify-end">
                <Button variant="danger" size="small" leadingIcon={RiDeleteBinLine} onClick={() => setDeleteOpen(true)}>
                  Delete account…
                </Button>
              </div>
            </Section>
          </div>
        ) : null}
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          if (deleting) return;
          setDeleteOpen(false);
          setDeletePassword('');
          setDeleteConfirm('');
          setDeleteError(null);
        }}
        size="md"
      >
        <form onSubmit={deleteAccount}>
          <DialogBody className="space-y-4 p-5">
            <div>
              <h2 className="text-headline-semibold text-text-primary">Delete your account?</h2>
              <p className="mt-1 text-body-2-regular text-text-secondary">
                All missions and settings for <span className="text-text-primary">{profile?.email}</span> are deleted
                immediately. You will be signed out on every device.
              </p>
            </div>
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
            <Input
              label='Type "DELETE" to confirm'
              value={deleteConfirm}
              onChange={setDeleteConfirm}
              autoComplete="off"
              isRequired
            />
          </DialogBody>
          <DialogFooter className="gap-3 px-5 py-4">
            <Button type="button" variant="secondary" size="small" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="small"
              disabled={deleting || !deletePassword || deleteConfirm !== 'DELETE'}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>

      <NotificationViewport position="bottom-end">
        {toasts.map((t) => (
          <Notification
            key={t.id}
            status={t.status}
            title={t.title}
            description={t.description}
            autoDismissDuration={5000}
            onDismiss={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
          />
        ))}
      </NotificationViewport>
    </div>
  );
}
