import type { SVGProps } from 'react';
import { cx } from '@/utils/cx';

/**
 * Flight Deck mark (D-16): a two-leg route from a launch square to a waypoint.
 * Monochrome, uses currentColor.
 */
export function FlightDeckMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cx('size-6', className)} {...props}>
      <path d="M5.5 18.5 L11 7 L19 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" />
      <rect x="3" y="16" width="5" height="5" fill="currentColor" />
      <circle cx="19" cy="13" r="2.5" fill="currentColor" />
    </svg>
  );
}

/** Wordmark: the mark plus "Flight Deck" in Geist Mono 500. Used site-wide. */
export function FlightDeckLogo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 text-text-primary', className)}>
      <FlightDeckMark className="size-5" />
      <span className="font-mono text-[15px]/[20px] font-medium tracking-[-0.01em]">Flight Deck</span>
    </span>
  );
}
