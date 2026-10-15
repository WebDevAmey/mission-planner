'use client';

import React, { useState } from 'react';
import { RiArrowLeftLine } from '@remixicon/react';
import { Input } from '@/components/base/input/input';
import { AuthLink, AuthShell } from '@/components/auth/auth-shell';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';

function BackToSignIn() {
  return (
    <AuthLink href="/login" className="inline-flex items-center gap-1">
      <RiArrowLeftLine className="size-4" aria-hidden /> Back to sign in
    </AuthLink>
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Something went wrong');
        setLoading(false);
        return;
      }
      setSent(true);
      setDevResetUrl(data.devResetUrl ?? null);
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your email" footer={<BackToSignIn />}>
        <FormMessage variant="success">
          If an account exists for <strong className="break-all">{email}</strong>, we&apos;ve sent a link to reset
          your password. It expires in 1 hour.
        </FormMessage>
        {devResetUrl && (
          <FormMessage variant="info" className="mb-0">
            Email delivery isn&apos;t configured in this environment. Use this link to continue:
            <br />
            <a href={devResetUrl} className="break-all font-mono underline">
              {devResetUrl}
            </a>
          </FormMessage>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a reset link."
      footer={<BackToSignIn />}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <FormMessage variant="error" className="mb-0">{error}</FormMessage>}

        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          value={email}
          autoFocus
          autoComplete="email"
          onChange={setEmail}
          placeholder="you@example.com"
        />

        <SubmitButton loading={loading} disabled={!email || loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
