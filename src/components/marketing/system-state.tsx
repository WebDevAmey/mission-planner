import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { ContourMap } from './figures/contour-map';
import { FlightDeckLogo } from './logo';
import { focusRing, type } from './styles';

/** Root not-found / error layout (DESIGN_SPEC §5.6): wordmark, code, one sentence, one action. */
export function SystemState({
  code,
  title,
  children,
  action,
}: {
  code: string;
  title: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-background-full text-text-primary">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
        <ContourMap route={false} />
      </div>
      <header className="relative px-4 py-5 sm:px-8">
        <Link href="/" aria-label="Flight Deck home" className={cx('inline-flex rounded-[2px]', focusRing)}>
          <FlightDeckLogo />
        </Link>
      </header>
      <main className="relative flex flex-1 items-center px-4 pb-24 sm:px-8">
        <div className="mx-auto flex w-full max-w-[560px] flex-col items-start gap-5 border border-fd-line bg-fd-surface p-6 sm:p-10">
          <p className={cx(type.data, 'text-text-tertiary')}>{code}</p>
          <h1 className={cx(type.head, 'text-text-primary')}>{title}</h1>
          <p className={cx(type.lead, 'text-text-secondary')}>{children}</p>
          <div className="mt-2">{action}</div>
        </div>
      </main>
    </div>
  );
}
