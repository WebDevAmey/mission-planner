'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';
export type IconButtonSize = 'xs' | 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Solid ink fill: the strong neutral action (accent is reserved for one per view).
  primary: 'bg-fd-ink text-fd-surface border border-fd-ink hover:bg-fd-ink/90',
  // The view's single accent-filled control.
  accent: 'bg-fd-accent text-fd-accent-ink border border-fd-accent hover:bg-fd-accent-hover hover:border-fd-accent-hover',
  secondary: 'bg-fd-surface text-fd-ink border border-fd-line-strong hover:bg-fd-surface-2 hover:border-fd-ink-3',
  outline: 'bg-transparent text-fd-ink border border-fd-line-strong hover:bg-fd-surface-2 hover:border-fd-ink-3',
  ghost: 'bg-transparent text-fd-ink-2 border border-transparent hover:bg-fd-surface-2 hover:text-fd-ink',
  danger: 'bg-transparent text-fd-ink-2 border border-transparent hover:bg-fd-danger-tint hover:text-fd-danger',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-6 gap-1 rounded-sm px-2 text-caption-1-medium',
  sm: 'h-8 gap-1.5 rounded-md px-2.5 text-body-2-medium',
  md: 'h-9 gap-2 rounded-md px-3.5 text-body-medium',
};

const ICON_SIZE_CLASSES: Record<IconButtonSize, string> = {
  xs: 'h-6 w-6 rounded-sm p-0',
  sm: 'h-8 w-8 rounded-md p-0',
  md: 'h-8 w-8 rounded-md p-0',
};

const BASE_CLASSES =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium ' +
  'transition-colors duration-120 ease-fd focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-accent ' +
  'disabled:pointer-events-none disabled:opacity-50';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Highlights the button as the current selection (e.g. an active panel toggle). */
  active?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', active, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        active && 'border-fd-line-strong bg-fd-surface-3 text-fd-ink',
        className
      )}
      {...props}
    />
  );
});

export interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Same visual language as Button, for navigation rather than an action —
 * renders an anchor (via next/link) so it's never nested inside a <button>. */
export const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(function ButtonLink(
  { className, variant = 'secondary', size = 'md', ...props },
  ref
) {
  return (
    <Link
      ref={ref}
      className={cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className)}
      {...props}
    />
  );
});

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  size?: IconButtonSize;
  active?: boolean;
  icon: React.ReactNode;
  'aria-label': string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, variant = 'ghost', size = 'sm', active, icon, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        BASE_CLASSES,
        VARIANT_CLASSES[variant],
        ICON_SIZE_CLASSES[size],
        active && 'border-fd-line-strong bg-fd-surface-3 text-fd-ink',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
