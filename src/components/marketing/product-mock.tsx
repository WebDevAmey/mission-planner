import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftSLine,
  RiCursorLine,
  RiDownload2Line,
  RiHome4Line,
  RiMapPinAddLine,
  RiRulerLine,
  RiShapeLine,
  RiSparkling2Line,
  RiForbid2Line,
  RiErrorWarningFill,
  RiCheckboxCircleFill,
} from '@remixicon/react';
import { Chip } from '@/components/base/badges/chip';
import { cx } from '@/utils/cx';

/**
 * Static, decorative mock of the Flight Deck editor (PRODUCT_SPEC §6.2):
 * 56px header, 48px tool rail, map-first canvas, right inspector with tabs,
 * and a single status bar. Pure markup + SVG, tokens only.
 */

const RAIL = [
  { icon: RiCursorLine, label: 'Select', active: false },
  { icon: RiMapPinAddLine, label: 'Add waypoint', active: false },
  { icon: RiShapeLine, label: 'Draw area', active: true },
  { icon: RiForbid2Line, label: 'Draw zone', active: false },
  { icon: RiHome4Line, label: 'Set home', active: false },
  { icon: RiRulerLine, label: 'Measure', active: false },
];

const WAYPOINTS = [
  { n: 1, cmd: 'Takeoff', alt: '30 m' },
  { n: 2, cmd: 'Survey start', alt: '60 m' },
  { n: 3, cmd: 'Waypoint', alt: '60 m' },
  { n: 4, cmd: 'Waypoint', alt: '60 m' },
  { n: 5, cmd: 'Waypoint', alt: '60 m' },
  { n: 6, cmd: 'Return to launch', alt: '—' },
];

// Boustrophedon survey lanes inside the field polygon (viewBox units).
const LANES = [
  [168, 118, 436, 104],
  [450, 136, 160, 150],
  [154, 182, 462, 168],
  [474, 200, 150, 214],
  [146, 246, 486, 232],
  [498, 264, 142, 278],
];

function MapCanvas() {
  const lanePath = LANES.map(([x1, y1, x2, y2], i) => `${i === 0 ? 'M' : 'L'}${x1} ${y1} L${x2} ${y2}`).join(' ');
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-neutral-900">
      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        {/* terrain contours */}
        <g className="fill-none stroke-neutral-800" strokeWidth="1.5">
          <path d="M-20 60 C 120 20, 260 90, 380 50 S 600 30, 680 70" />
          <path d="M-20 340 C 100 300, 240 380, 360 330 S 560 300, 680 350" />
          <path d="M-20 380 C 140 350, 260 410, 420 370 S 600 360, 680 390" />
          <ellipse cx="560" cy="110" rx="70" ry="42" />
          <ellipse cx="560" cy="110" rx="40" ry="22" />
        </g>
        {/* roads */}
        <path d="M-20 320 L 250 300 L 660 330" className="fill-none stroke-neutral-800" strokeWidth="10" strokeLinecap="round" />
        <path d="M110 -20 L 120 420" className="fill-none stroke-neutral-800" strokeWidth="6" strokeLinecap="round" />
        {/* field polygon */}
        <path
          d="M160 100 L 440 92 L 510 270 L 136 290 Z"
          className="fill-accent-500/10 stroke-accent-400"
          strokeWidth="1.5"
          strokeDasharray="6 5"
        />
        {/* no-fly zone */}
        <circle cx="560" cy="300" r="62" className="fill-rose-500/10 stroke-rose-400" strokeWidth="1.5" strokeDasharray="5 4" />
        {/* survey route */}
        <path d={`M92 330 L168 118 ${lanePath.replace(/^M168 118 /, '')}`} className="fill-none stroke-accent-300" strokeWidth="2.25" strokeLinejoin="round" />
        <path d="M142 278 L 92 330" className="fill-none stroke-accent-300/60" strokeWidth="2" strokeDasharray="4 4" />
        {/* waypoints */}
        {LANES.flatMap(([x1, y1, x2, y2], i) => [
          <circle key={`a${i}`} cx={x1} cy={y1} r="4.5" className="fill-neutral-950 stroke-accent-300" strokeWidth="2" />,
          <circle key={`b${i}`} cx={x2} cy={y2} r="4.5" className="fill-neutral-950 stroke-accent-300" strokeWidth="2" />,
        ])}
        {/* home */}
        <circle cx="92" cy="330" r="9" className="fill-lime-400 stroke-neutral-950" strokeWidth="2" />
      </svg>

      {/* overlays (HTML so text stays crisp and ≥12px) */}
      <div className="absolute start-3 top-3 hidden items-center gap-2 rounded-lg border border-border-button-default bg-background-primary-default/90 px-2.5 py-1.5 text-caption-1-medium text-text-secondary shadow-xs backdrop-blur sm:flex">
        Draw area · click to add corners · Esc to finish
      </div>
      <div className="absolute end-[4%] bottom-[30%] flex items-center gap-1 rounded-md bg-status-rose-background px-1.5 py-0.5 text-caption-1-medium text-status-rose-text">
        <RiForbid2Line className="size-3.5" aria-hidden />
        No-fly · Airfield
      </div>
      <div className="absolute start-[26%] top-[36%] rounded-md bg-background-primary-default/90 px-1.5 py-0.5 text-caption-1-medium text-text-primary shadow-xs">
        12 ha · 70% overlap
      </div>
    </div>
  );
}

function Inspector() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-s border-separator-border bg-background-secondary-default md:flex lg:w-64">
      <div className="flex items-center gap-3 border-b border-separator-border px-3 pt-2 text-caption-1-medium">
        <span className="border-b-2 border-accent-500 pb-2 text-text-primary">Waypoints</span>
        <span className="pb-2 text-text-secondary">Item</span>
        <span className="flex items-center gap-1 pb-2 text-text-secondary">
          Checks
          <span className="rounded-sm bg-status-yellow-background px-1 text-status-yellow-text">1</span>
        </span>
      </div>
      <ul className="flex flex-col gap-0.5 p-2">
        {WAYPOINTS.map((wp) => (
          <li
            key={wp.n}
            className={cx(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-caption-1-medium',
              wp.n === 3 ? 'bg-background-primary-hover text-text-primary' : 'text-text-secondary',
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-background-tertiary-default font-mono text-text-primary tabular-nums">
              {wp.n}
            </span>
            <span className="min-w-0 flex-1 truncate">{wp.cmd}</span>
            <span className="font-mono tabular-nums">{wp.alt}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-1.5 border-t border-separator-border p-3">
        <p className="flex items-center gap-1.5 text-caption-1-medium text-status-yellow-text">
          <RiErrorWarningFill className="size-4 shrink-0" aria-hidden />
          Terrain clearance 34 m at WP 5
        </p>
        <p className="flex items-center gap-1.5 text-caption-1-medium text-status-lime-text">
          <RiCheckboxCircleFill className="size-4 shrink-0" aria-hidden />
          All legs clear of zones
        </p>
      </div>
    </aside>
  );
}

export function ProductMock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cx(
        'overflow-hidden rounded-2xl border border-border-button-default bg-background-secondary-default shadow-2xl ring-1 ring-black/40',
        className,
      )}
    >
      {/* header */}
      <div className="flex h-12 items-center gap-2 border-b border-separator-border px-3 sm:h-14">
        <RiArrowLeftSLine className="size-5 shrink-0 text-foreground-icon-secondary" />
        <span className="min-w-0 truncate text-body-medium text-text-primary">North field survey</span>
        <Chip variant="caption" color="lime" className="hidden sm:inline-flex">
          Saved
        </Chip>
        <div className="ms-auto flex items-center gap-1.5">
          <RiArrowGoBackLine className="hidden size-4 text-foreground-icon-secondary sm:block" />
          <RiArrowGoForwardLine className="hidden size-4 text-foreground-icon-tertiary sm:block" />
          <span className="hidden items-center gap-1 rounded-lg border border-border-button-default px-2 py-1 text-caption-1-medium text-text-primary sm:flex">
            <RiSparkling2Line className="size-3.5 text-accent-400" />
            Ask AI
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-linear-to-b from-accent-500 to-accent-600 px-2 py-1 text-caption-1-medium text-white">
            <RiDownload2Line className="size-3.5" />
            Export
          </span>
        </div>
      </div>

      {/* body */}
      <div className="flex h-[260px] sm:h-[340px] lg:h-[400px]">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-e border-separator-border py-2 sm:w-12">
          {RAIL.map(({ icon: Icon, label, active }) => (
            <span
              key={label}
              className={cx(
                'flex size-8 items-center justify-center rounded-lg',
                active ? 'bg-accent-500/15 text-accent-300' : 'text-foreground-icon-secondary',
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          ))}
        </div>
        <MapCanvas />
        <Inspector />
      </div>

      {/* status bar */}
      <div className="flex h-10 items-center gap-3 overflow-hidden border-t border-separator-border px-3 font-mono text-caption-1-medium whitespace-nowrap text-text-secondary tabular-nums">
        <span className="text-text-primary">3.4 km</span>
        <span>6m 20s</span>
        <span>14 WPs</span>
        <span className="hidden sm:inline">max 60 m</span>
        <span className="hidden items-center gap-1 text-status-lime-text sm:flex">Risk low</span>
        <span className="ms-auto hidden text-status-yellow-text md:inline">1 warning · 0 errors</span>
      </div>
    </div>
  );
}
