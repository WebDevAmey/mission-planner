'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthLink, AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordRule } from '@/components/auth/password-rule';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';

const MIN_PASSWORD_LENGTH = 10;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  if (!token) {
    return (
      <AuthShell title="Invalid reset link" footer={<AuthLink href="/forgot-password">Request a new link</AuthLink>}>
        <FormMessage variant="error" className="mb-0">
          This password reset link is missing its token. Request a new one.
        </FormMessage>
      </AuthShell>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordLongEnough || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not reset your password');
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a new password for your account.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <FormMessage variant="error" className="mb-0">{error}</FormMessage>}

        <PasswordInput
          id="password"
          name="password"
          label="New password"
          value={password}
          autoFocus
          autoComplete="new-password"
          onChange={setPassword}
          onBlur={() => setTouched(true)}
          isInvalid={touched && !passwordLongEnough}
          placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
          aside={<PasswordRule met={passwordLongEnough} minLength={MIN_PASSWORD_LENGTH} />}
        />

        <SubmitButton loading={loading} disabled={!passwordLongEnough || loading}>
          {loading ? 'Saving…' : 'Reset password'}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
