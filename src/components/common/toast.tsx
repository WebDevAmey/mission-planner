'use client';

import type { ReactNode } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { useUIStore, type Toast } from '@/lib/store/ui-store';
import { cx } from '@/utils/cx';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItemProps {
  tone: ToastTone;
  title: ReactNode;
  description?: ReactNode;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}

const DOT: Record<ToastTone, string> = {
  success: 'bg-(color:--fd-ok)',
  error: 'bg-(color:--fd-danger)',
  warning: 'bg-(color:--fd-warn)',
  info: 'bg-(color:--fd-ink-3)',
};

/** One toast: hairline surface, float shadow, a status dot plus text (never colour alone). */
export function ToastItem({ tone, title, description, action, onDismiss }: ToastItemProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'pointer-events-auto motion-safe:animate-[fadeIn_200ms_cubic-bezier(.2,.8,.2,1)] flex w-full items-start gap-3 rounded-2lg border border-separator-border',
        'bg-background-primary-default py-3 ps-3.5 pe-2 shadow-(--fd-shadow-float)'
      )}
    >
      <span aria-hidden className={cx('mt-1.5 size-2 shrink-0 rounded-full', DOT[tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
        <p className="text-body-2-medium text-text-primary text-pretty">{title}</p>
        {description && <p className="break-words text-body-2-regular text-text-secondary">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="h-7 shrink-0 rounded-md px-2 text-body-2-medium text-text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-icon-secondary outline-none hover:bg-background-secondary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <RiCloseLine className="size-4" aria-hidden />
      </button>
    </div>
  );
}

const POSITION = {
  'bottom-end': 'bottom-4 end-4 sm:bottom-6 sm:end-6',
  'top-end': 'top-4 end-4 sm:top-6 sm:end-6',
  'bottom-start': 'bottom-4 start-4 sm:bottom-6 sm:start-6',
} as const;

/** Fixed stack for toasts; bottom-right by default. */
export function ToastStack({ position = 'bottom-end', children }: { position?: keyof typeof POSITION; children: ReactNode }) {
  return (
    <div
      className={cx('pointer-events-none fixed z-[2000] flex w-[calc(100vw-2rem)] max-w-[380px] flex-col gap-2', POSITION[position])}
    >
      {children}
    </div>
  );
}

/** App-wide toasts (editor + dashboard), fed by the UI store. */
export function ToastContainer({ position = 'bottom-end' }: { position?: 'bottom-end' | 'top-end' | 'bottom-start' }) {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <ToastStack position={position}>
      {toasts.map((t: Toast) => (
        <ToastItem
          key={t.id}
          tone={t.type}
          title={t.message}
          onDismiss={() => removeToast(t.id)}
          action={
            t.action
              ? {
                  label: t.action.label,
                  onClick: () => {
                    t.action?.onClick();
                    removeToast(t.id);
                  },
                }
              : undefined
          }
        />
      ))}
    </ToastStack>
  );
}
