import type { SVGProps } from 'react';
import { cx } from '@/utils/cx';

/** Flight Deck mark: a waypoint route over a deck line. Uses currentColor. */
export function FlightDeckMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cx('size-6', className)} {...props}>
      <path d="M4 17 L10 8 L15 13 L20 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="4" cy="17" r="2" fill="currentColor" />
      <circle cx="10" cy="8" r="1.6" fill="currentColor" />
      <circle cx="15" cy="13" r="1.6" fill="currentColor" />
      <circle cx="20" cy="5" r="2" fill="currentColor" />
      <path d="M3 21 H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function FlightDeckLogo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-text-primary', className)}>
      <span className="flex size-8 items-center justify-center rounded-2lg bg-linear-to-b from-accent-500 to-accent-600 text-white shadow-xs">
        <FlightDeckMark className="size-5" />
      </span>
      <span className="text-headline-semibold tracking-tight">Flight Deck</span>
    </span>
  );
}
