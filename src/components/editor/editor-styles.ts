/**
 * Editor class recipes (DESIGN_SPEC §3, §5.4). Every colour is a semantic token:
 * BoardUI utilities where one exists, otherwise the `--fd-*` variables from §3.1.
 * Kept in one place so the editor reads as one system.
 */

/** Floating map surfaces, menus and popovers: 10px radius + float shadow. */
export const FLOAT_PANEL = 'rounded-fd-overlay border border-separator-border bg-background-primary-default shadow-fd-float';

/** Popover override for BoardUI dropdowns used in the editor. */
export const MENU_PANEL = 'rounded-fd-overlay p-1.5 shadow-fd-float';

/** Focus ring: 2px accent, 2px offset (§6). */
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background-primary-default';
/** Inset ring for rows and controls that sit flush against an edge. */
export const FOCUS_RING_INSET = 'outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring';

/** 32px quiet icon button (header, panels). */
export const ICON_BUTTON = [
  'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition-colors duration-[120ms]',
  'hover:bg-background-primary-hover hover:text-text-primary active:bg-background-primary-active',
  'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent',
  'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[pressed]:bg-background-primary-active',
  FOCUS_RING,
].join(' ');

/** Mono caps label: table headers, map/telemetry labels (not section eyebrows). */
export const LABEL_MONO = 'font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-text-tertiary';
/** Literal coordinates, IDs, file extensions. */
export const DATA_MONO = 'font-mono text-[13px] leading-[18px] tabular-nums';
/** Panel / inspector section titles. */
export const PANEL_TITLE = 'text-[13px] leading-[18px] font-medium text-text-primary';

/** Selected list row: accent tint + 2px accent rule on the left edge. */
export const ROW_SELECTED = 'bg-fd-accent-tint shadow-[inset_2px_0_0_var(--fd-accent)]';

/** State colours (text, dot fill). Never used alone: always with text or a shape. */
export const TONE_TEXT = {
  ok: 'text-fd-ok',
  warn: 'text-fd-warn',
  danger: 'text-fd-danger',
  info: 'text-fd-info',
  muted: 'text-text-tertiary',
} as const;
export const TONE_DOT = {
  ok: 'bg-fd-ok',
  warn: 'bg-fd-warn',
  danger: 'bg-fd-danger',
  info: 'bg-fd-info',
  muted: 'bg-text-tertiary',
} as const;
export type Tone = keyof typeof TONE_TEXT;

/** Map legend swatches (mirror the MapLibre paint in mission-map.tsx). */
export const SWATCH = {
  route: 'h-[3px] w-6 rounded-full bg-fd-accent',
  routeError: 'h-[3px] w-6 rounded-full bg-fd-danger',
  routeHome: 'h-0 w-6 border-t-2 border-dashed border-fd-accent',
  keepOut: 'size-3 rounded-[2px] border-[1.5px] border-dashed border-fd-danger bg-fd-danger/12',
  keepIn: 'size-3 rounded-[2px] border-[1.5px] border-fd-info bg-fd-info/8',
  preview: 'h-0 w-6 border-t border-dashed border-fd-info',
  waypoint: 'size-3 rounded-full border-[1.5px] border-text-primary bg-background-primary-default',
  takeoff: 'size-2.5 rounded-[1px] bg-text-primary',
} as const;

/** Ink-filled button for a panel's own confirm action (Apply, Add survey, Load).
 * Pass with `variant="secondary"`; Export keeps the only accent fill in the view. */
export const INK_BUTTON =
  'border-transparent bg-text-primary text-background-primary-default hover:border-transparent hover:bg-text-primary/85 active:bg-text-primary/80 disabled:bg-background-primary-disabled disabled:text-text-tertiary';

/** Dense inspector row: 32px, 14px text (DESIGN_SPEC §5.4). */
export const ROW = 'flex min-h-8 w-full items-center gap-2 px-3 text-start text-[14px] transition-colors duration-[120ms]';

/** Segmented control built on react-aria Tabs (inspector sections, assistant views). */
export const SEGMENT_LIST = 'flex flex-1 gap-0.5 rounded-fd-control bg-background-secondary-default p-0.5';
export const SEGMENT_TAB = [
  'relative flex h-7 flex-1 cursor-default items-center justify-center gap-1.5 rounded-[5px] px-2 text-[13px] whitespace-nowrap text-text-secondary transition-colors duration-[120ms] max-md:h-9',
  'hover:text-text-primary data-[selected]:bg-background-primary-default data-[selected]:font-medium data-[selected]:text-text-primary data-[selected]:shadow-[0_0_0_1px_var(--color-separator-border)]',
  FOCUS_RING_INSET,
].join(' ');
