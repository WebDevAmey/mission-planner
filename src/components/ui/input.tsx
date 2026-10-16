'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-8 w-full rounded-md border border-fd-line-strong bg-fd-surface px-2.5 text-body-2-regular tabular-nums text-fd-ink outline-none transition-colors',
          'placeholder:text-fd-ink-3',
          'focus-visible:border-fd-accent focus-visible:ring-1 focus-visible:ring-fd-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-fd-danger aria-[invalid=true]:focus-visible:ring-fd-danger',
          className
        )}
        {...props}
      />
    );
  }
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex w-full rounded-md border border-fd-line-strong bg-fd-surface px-2.5 py-2 text-body-2-regular text-fd-ink outline-none transition-colors',
          'placeholder:text-fd-ink-3',
          'focus-visible:border-fd-accent focus-visible:ring-1 focus-visible:ring-fd-accent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      />
    );
  }
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1 block text-caption-1-medium text-fd-ink-2', className)}
      {...props}
    />
  );
}
