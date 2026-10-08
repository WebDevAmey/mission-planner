'use client';

import { useUIStore, type Toast } from '@/lib/store/ui-store';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const TOAST_CLASSES: Record<Toast['type'], string> = {
  success: 'border-green text-green shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_0_1px_var(--color-green-bg)]',
  error: 'border-red text-red shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_0_1px_var(--color-red-bg)]',
  warning: 'border-amber text-amber shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_0_1px_var(--color-amber-bg)]',
  info: 'border-cyan text-cyan shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_0_1px_var(--color-blue-bg)]',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useUIStore();

  return (
    <div
      className={cn(
        'flex min-w-[200px] max-w-[320px] items-center gap-2 rounded-md border bg-bg-raised px-2.5 py-1.5',
        'animate-[slideInRight_200ms_ease] font-mono text-[11px] backdrop-blur-sm',
        TOAST_CLASSES[toast.type]
      )}
    >
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-0.5 text-text-muted transition-colors hover:text-text"
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
    <div className="pointer-events-none fixed bottom-5 right-4 z-[99999] flex flex-col gap-1.5">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
