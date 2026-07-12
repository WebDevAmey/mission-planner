'use client';

import { useUIStore, type Toast } from '@/lib/store/ui-store';
import { X } from 'lucide-react';

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useUIStore();

  const colors: Record<Toast['type'], string> = {
    success: 'var(--color-green)',
    error: 'var(--color-red)',
    warning: 'var(--color-amber)',
    info: 'var(--color-cyan)',
  };

  const bgs: Record<Toast['type'], string> = {
    success: 'var(--color-green-bg)',
    error: 'var(--color-red-bg)',
    warning: 'var(--color-amber-bg)',
    info: 'var(--color-blue-bg)',
  };

  const color = colors[toast.type];
  const bg = bgs[toast.type];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '7px 10px',
        backgroundColor: 'var(--color-bg-raised)',
        border: `1px solid ${color}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px ${bg}`,
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        color: color,
        backdropFilter: 'blur(4px)',
        animation: 'slideInRight 200ms ease',
        minWidth: '200px',
        maxWidth: '320px',
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          display: 'flex',
          padding: '1px',
          flexShrink: 0,
        }}
      >
        <X size={11} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '16px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
