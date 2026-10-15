import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { linkButtonStyles } from '@/components/base/buttons/link-button';
import { FlightDeckLogo } from '@/components/marketing/logo';
import { cx } from '@/utils/cx';

/**
 * Auth page frame built on BoardUI's AuthCard surface: logo above a
 * rounded card on the Flight Deck background, with an optional footer line.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-clip bg-background-full px-4 py-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-accent-500)_0%,transparent_70%)] opacity-15"
      />
      <div className="relative flex w-full max-w-[400px] flex-col items-center gap-6">
        <Link href="/" aria-label="Flight Deck home" className="rounded-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent-500">
          <FlightDeckLogo />
        </Link>
        <main className="flex w-full flex-col rounded-3xl border border-border-button-default bg-background-secondary-default p-6 shadow-xs sm:p-8">
          <div className="mb-6 flex flex-col gap-1.5">
            <h1 className="text-title-2-medium text-text-primary">{title}</h1>
            {subtitle && <p className="text-body-regular text-text-secondary">{subtitle}</p>}
          </div>
          {children}
        </main>
        {footer && <div className="text-center text-body-regular text-text-secondary">{footer}</div>}
      </div>
    </div>
  );
}

/** next/link styled as a BoardUI LinkButton, for in-app auth navigation. */
export function AuthLink({
  className,
  size = 'medium',
  variant = 'primary',
  children,
  ...props
}: ComponentProps<typeof Link> & { size?: 'medium' | 'small' | 'xs'; variant?: 'primary' | 'secondary' }) {
  return (
    <Link
      className={cx(linkButtonStyles.base, linkButtonStyles.size[size], linkButtonStyles.variant[variant], className)}
      {...props}
    >
      {children}
    </Link>
  );
}
