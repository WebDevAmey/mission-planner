'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { AuthShell } from '@/components/auth/auth-shell';
import { FormMessage } from '@/components/auth/form-message';

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
      <AuthShell
        title="Check your email"
        footer={
          <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-text hover:text-green">
            <ArrowLeft size={12} /> Back to sign in
          </Link>
        }
      >
        <FormMessage variant="success">
          If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password. It
          expires in 1 hour.
        </FormMessage>
        {devResetUrl && (
          <div className="rounded-sm border border-amber/40 bg-amber-bg px-3 py-2 font-mono text-[11px] text-amber">
            Email delivery isn&apos;t configured in this environment. Use this link to continue:
            <br />
            <a href={devResetUrl} className="break-all underline">
              {devResetUrl}
            </a>
          </div>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email on your account and we'll send you a reset link."
      footer={
        <Link href="/login" className="inline-flex items-center gap-1 font-semibold text-text hover:text-green">
          <ArrowLeft size={12} /> Back to sign in
        </Link>
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
          className="mb-5 h-9 text-[13px]"
        />

        <Button type="submit" variant="primary" disabled={!email || loading} className="w-full font-sans">
          {loading ? <Spinner size={14} className="text-background" /> : <>Send reset link <ArrowRight size={14} /></>}
        </Button>
      </form>
    </AuthShell>
  );
}
