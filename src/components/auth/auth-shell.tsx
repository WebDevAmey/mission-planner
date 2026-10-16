import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { linkButtonStyles } from '@/components/base/buttons/link-button';
import { ContourMap } from '@/components/marketing/figures/contour-map';
import { FlightDeckLogo } from '@/components/marketing/logo';
import { cx } from '@/utils/cx';

/**
 * Auth page frame (DESIGN_SPEC §5.2): form card on the left five columns, the
 * chart-sheet figure on the right seven on desktop. Phones get the form only,
 * with the wordmark on top.
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
    <div className="grid min-h-dvh bg-background-full lg:grid-cols-12">
      <div className="flex flex-col px-4 py-6 sm:px-8 lg:col-span-5 lg:px-12 lg:py-8">
        <Link
          href="/"
          aria-label="Flight Deck home"
          className="self-start rounded-fd-frame outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fd-accent"
        >
          <FlightDeckLogo />
        </Link>
        <div className="flex flex-1 flex-col items-center justify-center py-10">
          <div className="flex w-full max-w-[400px] flex-col gap-5">
            <main className="flex w-full flex-col rounded-fd-control border border-fd-line bg-background-primary-default p-6 sm:p-8">
              <div className="mb-6 flex flex-col gap-1.5">
                <h1 className="text-[24px]/[30px] font-medium tracking-[-0.015em] text-balance text-text-primary">{title}</h1>
                {subtitle && <p className="text-[15px]/[22px] text-pretty text-text-secondary">{subtitle}</p>}
              </div>
              {children}
            </main>
            {footer && <div className="text-center text-[15px]/[22px] text-text-secondary">{footer}</div>}
          </div>
        </div>
      </div>

      <figure aria-hidden className="relative hidden border-l border-fd-line bg-fd-surface-2 lg:col-span-7 lg:block">
        <div className="absolute inset-0 overflow-hidden">
          <ContourMap viewBox="380 60 760 820" preserveAspectRatio="xMidYMid slice" />
        </div>
        <figcaption className="text-label-mono absolute bottom-6 left-8 text-text-tertiary">
          Survey route over terrain · 6 waypoints · range rings from launch
        </figcaption>
      </figure>
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
