'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { FormMessage } from '@/components/auth/form-message';
import { cn } from '@/lib/utils';

const MIN_PASSWORD_LENGTH = 10;

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touchedPassword, setTouchedPassword] = useState(false);

  const passwordLongEnough = password.length >= MIN_PASSWORD_LENGTH;
  const emailLooksValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
  const canSubmit = emailLooksValid && passwordLongEnough && !loading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Could not create your account');
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
    <AuthShell
      title="Create your account"
      subtitle="Set up access to plan and save missions."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-text hover:text-green">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        {error && <FormMessage variant="error">{error}</FormMessage>}

        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          type="text"
          value={name}
          autoFocus
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder="Jordan Rivera"
          className="mb-3 h-9 text-[13px]"
        />

        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          autoComplete="email"
          aria-invalid={email.length > 0 && !emailLooksValid}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mb-3 h-9 text-[13px]"
        />

        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          value={password}
          autoComplete="new-password"
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouchedPassword(true)}
          aria-invalid={touchedPassword && !passwordLongEnough}
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

        <Button type="submit" variant="primary" disabled={!canSubmit} className="w-full font-sans">
          {loading ? <Spinner size={14} className="text-background" /> : <>Create account <ArrowRight size={14} /></>}
        </Button>

        <p className="mt-4 font-sans text-[11px] leading-relaxed text-text-muted">
          By signing up you agree this is a planning tool for ArduPilot-compatible missions — always verify a
          mission before flight.
        </p>
      </form>
    </AuthShell>
  );
}
