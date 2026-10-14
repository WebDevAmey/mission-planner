'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';
export type IconButtonSize = 'xs' | 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-foreground text-background border border-foreground hover:bg-foreground/90',
  accent: 'bg-green text-black border border-green font-mono hover:bg-green-dim',
  secondary: 'bg-bg-raised text-text border border-border-mid hover:bg-bg-hover hover:border-border-hi',
  outline: 'bg-transparent text-text border border-border-mid hover:bg-bg-hover hover:border-border-hi',
  ghost: 'bg-transparent text-text-dim border border-transparent hover:bg-bg-hover hover:text-text',
  danger: 'bg-transparent text-text-dim border border-transparent hover:bg-red-bg hover:text-red',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-6 gap-1 rounded-sm px-2 text-[10px] font-mono',
  sm: 'h-7 gap-1.5 rounded-sm px-2.5 text-xs',
  md: 'h-9 gap-2 rounded-md px-4 text-[13px]',
};

const ICON_SIZE_CLASSES: Record<IconButtonSize, string> = {
  xs: 'h-6 w-6 rounded-sm p-0',
  sm: 'h-7 w-7 rounded-sm p-0',
  md: 'h-8 w-8 rounded-md p-0',
};

const BASE_CLASSES =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium ' +
  'transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
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
        active && 'border-green bg-green-bg text-green',
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
        active && 'border-green bg-green-bg text-green',
        className
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
