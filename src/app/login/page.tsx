'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/mission-planner';

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-[360px] rounded-lg border border-border-mid bg-bg-panel p-7 shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            <Lock size={14} className="text-background" />
          </div>
          <span className="font-sans text-[15px] font-bold text-text">Flight Deck</span>
        </div>
        <p className="mb-6 font-sans text-[13px] text-text-dim">
          Enter the access password to continue to the mission planner.
        </p>

        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          aria-invalid={!!error}
          className={cn('mb-2.5 h-9 text-[13px]', error && 'border-red')}
        />

        {error && <div className="mb-2.5 font-mono text-[11px] text-red">{error}</div>}

        <Button
          type="submit"
          variant="primary"
          disabled={!password || loading}
          className="mt-1 w-full font-sans"
        >
          {loading ? <Spinner size={14} className="text-background" /> : <>Continue <ArrowRight size={14} /></>}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
