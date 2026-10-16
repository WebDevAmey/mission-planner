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
            tone === 'danger' ? 'border-fd-danger/40 bg-fd-danger-tint text-fd-danger' : 'border-fd-line bg-fd-surface-2 text-fd-ink-3'
          )}
        >
          <Icon size={16} />
        </div>
      )}
      <div className="text-body-medium text-fd-ink">{title}</div>
      {description && (
        <p className="max-w-[280px] text-body-2-regular text-fd-ink-2">{description}</p>
      )}
      {action}
    </div>
  );
}
