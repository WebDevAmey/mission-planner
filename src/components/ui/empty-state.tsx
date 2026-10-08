import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  tone?: 'neutral' | 'danger';
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, tone = 'neutral', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {Icon && (
        <div
          className={cn(
            'mb-1 flex h-9 w-9 items-center justify-center rounded-full border',
            tone === 'danger' ? 'border-red/40 bg-red-bg text-red' : 'border-border bg-bg-raised text-text-muted'
          )}
        >
          <Icon size={16} />
        </div>
      )}
      <div className="font-mono text-[11px] font-semibold text-text-dim">{title}</div>
      {description && (
        <p className="max-w-[240px] font-sans text-[11px] leading-relaxed text-text-muted">{description}</p>
      )}
      {action}
    </div>
  );
}
