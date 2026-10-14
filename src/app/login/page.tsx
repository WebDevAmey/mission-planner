'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { FormMessage } from '@/components/auth/form-message';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

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
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-text hover:text-green">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        {error && <FormMessage variant="error">{error}</FormMessage>}

        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          autoFocus
          autoComplete="email"
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mb-3 h-9 text-[13px]"
        />

        <div className="mb-1.5 flex items-center justify-between">
          <Label htmlFor="password" className="mb-0">Password</Label>
          <Link href="/forgot-password" className="font-sans text-[11px] text-text-dim hover:text-text">
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mb-5 h-9 text-[13px]"
        />

        <Button type="submit" variant="primary" disabled={!email || !password || loading} className="w-full font-sans">
          {loading ? <Spinner size={14} className="text-background" /> : <>Sign in <ArrowRight size={14} /></>}
        </Button>
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
