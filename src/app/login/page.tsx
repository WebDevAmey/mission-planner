'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, ArrowRight, Loader2 } from 'lucide-react';

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
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'var(--color-bg-base)',
      padding: '24px',
    }}>
      <form onSubmit={submit} style={{
        width: '100%', maxWidth: '360px', padding: '32px 28px', borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border-mid)',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'var(--color-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={14} color="var(--color-background)" />
          </div>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)' }}>
            Flight Deck
          </span>
        </div>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-dim)', margin: '0 0 22px' }}>
          Enter the access password to continue to the mission planner.
        </p>

        <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          style={{
            width: '100%', boxSizing: 'border-box', background: 'var(--color-bg-raised)',
            border: `1px solid ${error ? 'var(--color-red)' : 'var(--color-border-mid)'}`,
            borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
            fontSize: '13px', padding: '9px 10px', outline: 'none', marginBottom: '10px',
          }}
        />

        {error && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-red)', marginBottom: '10px' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!password || loading}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px', backgroundColor: 'var(--color-foreground)', border: 'none', borderRadius: 'var(--radius-sm)',
            color: 'var(--color-background)', fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 700,
            cursor: !password || loading ? 'not-allowed' : 'pointer', opacity: !password || loading ? 0.6 : 1,
            marginTop: '4px',
          }}
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <>Continue <ArrowRight size={14} /></>}
        </button>
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
