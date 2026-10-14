'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { FormMessage } from '@/components/auth/form-message';
import { cn } from '@/lib/utils';

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
      <AuthShell title="Invalid reset link" footer={<Link href="/forgot-password" className="font-semibold text-text hover:text-green">Request a new link</Link>}>
        <FormMessage variant="error">This password reset link is missing its token. Request a new one.</FormMessage>
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
      <form onSubmit={submit} noValidate>
        {error && <FormMessage variant="error">{error}</FormMessage>}

        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          value={password}
          autoFocus
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={touched && !passwordLongEnough}
          placeholder="••••••••"
          className="h-9 text-[13px]"
        />
        <div
          className={cn(
            'mb-5 mt-1.5 flex items-center gap-1.5 font-mono text-[10.5px]',
            passwordLongEnough ? 'text-green' : 'text-text-muted'
          )}
        >
          {passwordLongEnough ? <Check size={11} /> : <X size={11} />}
          At least {MIN_PASSWORD_LENGTH} characters
        </div>

        <Button type="submit" variant="primary" disabled={!passwordLongEnough || loading} className="w-full font-sans">
          {loading ? <Spinner size={14} className="text-background" /> : <>Reset password <ArrowRight size={14} /></>}
        </Button>
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
