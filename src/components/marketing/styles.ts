/**
 * Marketing type and layout classes (DESIGN_SPEC §3.2, §3.3).
 * Kept in one place so every section uses the same five sizes and the same
 * 12-column, 1200px grid with a 16px phone gutter.
 */

export const type = {
  /** display-1 desktop, display-2 tablet, 40px phone. Landing H1 only. */
  display:
    'text-[40px]/[44px] tracking-[-0.03em] font-medium text-balance sm:text-[48px]/[52px] lg:text-[64px]/[68px]',
  /** Section heads: title-1 on phones, display-2 on desktop. */
  head: 'text-[32px]/[38px] tracking-[-0.02em] font-medium text-balance lg:text-[48px]/[52px] lg:tracking-[-0.025em]',
  title2: 'text-[24px]/[30px] tracking-[-0.015em] font-medium text-balance',
  title3: 'text-[18px]/[26px] font-medium',
  lead: 'text-[18px]/[28px] text-pretty',
  body: 'text-[16px]/[24px] text-pretty',
  small: 'text-[13px]/[18px]',
  /** 11/14 uppercase mono: table headers, map labels, figure captions only. */
  label: 'font-mono text-[11px]/[14px] font-medium uppercase tracking-[0.06em]',
  /** Coordinates, IDs and file extensions. */
  data: 'font-mono text-[13px]/[18px] tabular-nums',
} as const;

/** 12-column page grid, 1200px max, 16px phone gutter. */
export const wrap = 'mx-auto w-full max-w-[1232px] px-4 sm:px-6 lg:px-4';
export const grid = 'grid grid-cols-4 gap-x-4 sm:grid-cols-12 sm:gap-x-6';

/** Section spacing: 64px phone, 96px desktop, hairline between sections. */
export const section = 'scroll-mt-16 border-t border-(--fd-line) py-16 lg:py-24';

/** Focus ring per §6: 2px accent, 2px offset. */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-(--fd-accent)';

/** Plain text link in running copy. */
export const textLink = `underline decoration-(--fd-line-strong) decoration-1 underline-offset-[0.2em] transition-colors duration-[120ms] hover:decoration-current ${focusRing}`;

/** Square marketing buttons (2px radius). One primary per view. */
const btnBase = `inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[2px] px-4 text-[15px]/[20px] font-medium transition-[background-color,border-color,color,transform] duration-[120ms] active:scale-[.98] motion-reduce:active:scale-100 ${focusRing}`;
export const button = {
  primary: `${btnBase} bg-(--fd-accent) text-(--fd-accent-ink) hover:bg-fd-accent-hover`,
  secondary: `${btnBase} border border-(--fd-line-strong) bg-(--fd-surface) text-(--fd-ink) hover:bg-(--fd-surface-3)`,
  small: 'h-9 px-3 text-[14px]/[20px]',
} as const;
