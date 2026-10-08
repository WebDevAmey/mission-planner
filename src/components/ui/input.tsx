'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-7 w-full rounded-sm border border-border-mid bg-bg-raised px-2 font-mono text-[11px] text-text outline-none transition-colors',
          'placeholder:text-text-muted',
          'focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green-bg',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-[invalid=true]:border-red aria-[invalid=true]:focus-visible:ring-red-bg',
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
          'flex w-full rounded-sm border border-border-mid bg-bg-raised px-2 py-1.5 font-mono text-[11px] text-text outline-none transition-colors',
          'placeholder:text-text-muted',
          'focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green-bg',
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
      className={cn('mb-1 block font-mono text-[9px] font-medium uppercase tracking-wide text-text-muted', className)}
      {...props}
    />
  );
}
