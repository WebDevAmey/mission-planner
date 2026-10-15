'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/base/input/input';
import { AuthLink, AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordRule } from '@/components/auth/password-rule';
import { FormMessage } from '@/components/auth/form-message';
import { SubmitButton } from '@/components/auth/submit-button';

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
      subtitle="Free during beta. Plan, check and export ArduPilot missions."
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && <FormMessage variant="error" className="mb-0">{error}</FormMessage>}

        <Input
          id="name"
          name="name"
          type="text"
          label="Name (optional)"
          value={name}
          autoFocus
          autoComplete="name"
          onChange={setName}
          placeholder="Jordan Rivera"
        />

        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          value={email}
          autoComplete="email"
          isInvalid={email.length > 0 && !emailLooksValid}
          onChange={setEmail}
          placeholder="you@example.com"
        />

        <div className="flex flex-col gap-1.5">
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            value={password}
            autoComplete="new-password"
            onChange={setPassword}
            onBlur={() => setTouchedPassword(true)}
            isInvalid={touchedPassword && !passwordLongEnough}
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            aside={<PasswordRule met={passwordLongEnough} minLength={MIN_PASSWORD_LENGTH} />}
          />
        </div>

        <SubmitButton loading={loading} disabled={!canSubmit}>
          {loading ? 'Creating account…' : 'Create account'}
        </SubmitButton>

        <p className="text-caption-1-regular text-text-tertiary">
          By signing up you agree this is a planning tool for ArduPilot-compatible missions — always verify a
          mission before flight.
        </p>
      </form>
    </AuthShell>
  );
}
