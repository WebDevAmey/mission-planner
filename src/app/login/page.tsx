'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/base/input/input';
import { AuthLink, AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';
import { safeNextPath } from '@/lib/http/safe-redirect';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only same-site paths: router.push('//evil.example') would leave the app (open redirect).
  const next = safeNextPath(searchParams.get('next')) ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to the mission planner."
      footer={
        <>
          Don&apos;t have an account? <AuthLink href="/signup">Sign up</AuthLink>
        </>
      }
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

        <PasswordInput
          id="password"
          name="password"
          label="Password"
          value={password}
          autoComplete="current-password"
          onChange={setPassword}
          placeholder="Enter your password"
          aside={
            <AuthLink href="/forgot-password" size="small" variant="secondary">
              Forgot password?
            </AuthLink>
          }
        />

        <SubmitButton loading={loading} disabled={!email || !password || loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </SubmitButton>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
