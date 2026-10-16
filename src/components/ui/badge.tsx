import * as React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'green' | 'amber' | 'red' | 'blue' | 'neutral';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  green: 'badge-green',
  amber: 'badge-amber',
  red: 'badge-red',
  blue: 'badge-blue',
  neutral: 'bg-fd-surface-2 text-fd-ink-2',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Renders a small status dot before the label instead of relying on color alone. */
  dot?: boolean;
}

export function Badge({ variant = 'neutral', dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('badge inline-flex items-center gap-1', VARIANT_CLASSES[variant], className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
