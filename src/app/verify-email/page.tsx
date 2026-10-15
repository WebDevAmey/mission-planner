'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthShell } from '@/components/auth/auth-shell';
import { FormMessage } from '@/components/auth/form-message';
import { RiLoader4Line } from '@remixicon/react';
import { ButtonLink } from '@/components/base/buttons/button';

type Status = 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>(() => (token ? 'verifying' : 'error'));
  const [error, setError] = useState<string | null>(() =>
    token ? null : 'This verification link is missing its token.'
  );

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.ok) {
          setStatus('error');
          setError(data.error || 'Could not verify your email');
          return;
        }
        setStatus('success');
      } catch {
        if (!cancelled) {
          setStatus('error');
          setError('Could not reach the server. Try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <AuthShell title="Verify your email">
      {status === 'verifying' && (
        <div role="status" className="flex items-center gap-2 text-body-regular text-text-secondary">
          <RiLoader4Line className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> Verifying your email…
        </div>
      )}
      {status === 'success' && (
        <>
          <FormMessage variant="success">Your email address has been verified.</FormMessage>
          <ButtonLink href="/dashboard" variant="primary" className="w-full">
            Go to dashboard
          </ButtonLink>
        </>
      )}
      {status === 'error' && (
        <>
          <FormMessage variant="error">{error}</FormMessage>
          <ButtonLink href="/dashboard" variant="secondary" className="w-full">
            Go to dashboard
          </ButtonLink>
        </>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
