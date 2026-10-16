import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftSLine,
  RiCursorLine,
  RiDownload2Line,
  RiFocus3Line,
  RiForbid2Line,
  RiMapPinAddLine,
  RiMore2Line,
  RiRulerLine,
  RiShapeLine,
  RiStackLine,
} from '@remixicon/react';
import { cx } from '@/utils/cx';
import { hillContours, polyline, type Pt } from './figures/geometry';
import { type } from './styles';

/**
 * Static picture of the mission editor (DESIGN_SPEC §5.4), drawn with the same
 * tokens the app uses: 48px header, tool rail, map with a survey and its route,
 * inspector list and status bar. Decorative markup + SVG; one description for
 * assistive tech on the wrapper.
 */

const RAIL = [
  { icon: RiCursorLine, label: 'Select' },
  { icon: RiMapPinAddLine, label: 'Waypoint' },
  { icon: RiShapeLine, label: 'Survey area', active: true },
  { icon: RiForbid2Line, label: 'Zone' },
  { icon: RiRulerLine, label: 'Measure' },
];

const ROWS = [
  { n: 1, cmd: 'Takeoff', alt: 30 as number | null },
  ...Array.from({ length: 10 }, (_, i) => ({ n: i + 2, cmd: 'Waypoint', alt: 60 as number | null })),
  { n: 12, cmd: 'Return to launch', alt: null },
];
const SELECTED = 4;

// Survey lanes inside the field (viewBox 640 × 400), flown boustrophedon.
const LANES: [Pt, Pt][] = [
  [[196, 112], [430, 98]],
  [[442, 132], [184, 148]],
  [[176, 184], [454, 168]],
  [[466, 204], [168, 220]],
  [[160, 256], [478, 240]],
];
const HOME: Pt = [104, 322];
const PATH: Pt[] = [HOME, ...LANES.flat()];
const FIELD = 'M188 92 L 436 80 L 498 262 L 148 278 Z';
const CONTOURS = [
  ...hillContours({ cx: 560, cy: 96, r0: 10, step: 18, rings: 5, seed: 1.4, sx: 1.3 }),
  ...hillContours({ cx: 70, cy: 70, r0: 14, step: 20, rings: 4, seed: 3.2 }),
];

function MapCanvas() {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden bg-(--fd-surface-2)">
      <svg viewBox="0 0 640 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <path
          d={[...Array.from({ length: 9 }, (_, i) => `M${i * 80 + 40} 0 V400`), ...Array.from({ length: 5 }, (_, i) => `M0 ${i * 80 + 40} H640`)].join(' ')}
          className="fill-none stroke-(--fd-line)"
          strokeWidth="1"
        />
        <g className="fill-none stroke-(--fd-ink-3)" opacity="0.3">
          {CONTOURS.map((d, i) => (
            <path key={i} d={d} strokeWidth="0.8" />
          ))}
        </g>
        {/* road */}
        <path d="M-10 340 C 160 318, 300 352, 650 326" className="fill-none stroke-(--fd-surface)" strokeWidth="9" strokeLinecap="round" />
        <path d="M-10 340 C 160 318, 300 352, 650 326" className="fill-none stroke-(--fd-line-strong)" strokeWidth="1" opacity="0.6" />

        {/* survey area: info stroke and 8% fill */}
        <path d={FIELD} className="fill-(--fd-info) stroke-(--fd-info)" fillOpacity="0.08" strokeWidth="1.25" />
        {/* keep-out zone: danger 12% fill, dashed stroke */}
        <circle cx="566" cy="300" r="58" className="fill-(--fd-danger) stroke-(--fd-danger)" fillOpacity="0.12" strokeWidth="1.5" strokeDasharray="5 4" />

        {/* route: casing + accent line, dashed return */}
        <path d={polyline([LANES[4][1], HOME])} className="fill-none stroke-(--fd-ink-3)" strokeWidth="1.25" strokeDasharray="3 4" />
        <path d={polyline(PATH)} className="fill-none stroke-(--fd-surface)" strokeWidth="5" strokeLinejoin="round" />
        <path d={polyline(PATH)} className="fill-none stroke-(--fd-accent)" strokeWidth="2.5" strokeLinejoin="round" />

        {/* waypoints */}
        {PATH.slice(1).map(([x, y], i) => {
          const n = i + 2;
          const selected = n === SELECTED;
          return (
            <g key={n}>
              <circle cx={x} cy={y} r="8.5" className={selected ? 'fill-(--fd-accent) stroke-(--fd-accent)' : 'fill-(--fd-surface) stroke-(--fd-ink)'} strokeWidth="1.25" />
              <text
                x={x}
                y={y + 3.4}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="500"
                className={cx('font-mono', selected ? 'fill-(--fd-accent-ink)' : 'fill-(--fd-ink)')}
              >
                {n}
              </text>
            </g>
          );
        })}
        {/* launch */}
        <rect x={HOME[0] - 7} y={HOME[1] - 7} width="14" height="14" className="fill-(--fd-ink)" />
      </svg>

      {/* overlays in HTML so text stays crisp */}
      <div className="absolute top-3 left-3 hidden items-center gap-2 rounded-[10px] border border-(--fd-line) bg-(--fd-surface) px-2.5 py-1.5 text-[12px]/[16px] text-(--fd-ink-2) shadow-fd-float sm:flex">
        <span className="text-(--fd-ink)">Survey area</span>
        <span className="tabular-nums">12.4 ha · 5 lanes · 70% side overlap</span>
      </div>
      <div className="absolute right-[6%] bottom-[30%] hidden items-center gap-1 rounded-[4px] bg-(--fd-surface) px-1.5 py-0.5 text-[12px]/[16px] text-(--fd-danger) sm:flex">
        <RiForbid2Line className="size-3.5" aria-hidden />
        Keep-out · Airfield
      </div>
      <p className={cx(type.data, 'absolute bottom-2 left-3 text-[11px]/[14px] text-(--fd-ink-2)')}>51.48231, −0.60114</p>
    </div>
  );
}

function Inspector() {
  return (
    <div className="hidden w-[248px] shrink-0 flex-col border-l border-(--fd-line) bg-(--fd-surface) md:flex lg:w-[288px]">
      <div className="p-2">
        <div className="grid grid-cols-3 gap-0.5 rounded-[6px] bg-(--fd-surface-2) p-0.5 text-[12px]/[16px]">
          <span className="rounded-[4px] bg-(--fd-surface) py-1 text-center font-medium text-(--fd-ink) ring-1 ring-(--fd-line)">Waypoints</span>
          <span className="py-1 text-center text-(--fd-ink-2)">Item</span>
          <span className="flex items-center justify-center gap-1 py-1 text-(--fd-ink-2)">
            Checks
            <span className="size-1.5 rounded-full bg-(--fd-warn)" />
          </span>
        </div>
      </div>
      <div className={cx(type.label, 'flex h-7 items-center justify-between border-y border-(--fd-line) bg-(--fd-surface-2) px-3 text-(--fd-ink-3)')}>
        <span>#&nbsp;&nbsp;Command</span>
        <span>Alt</span>
      </div>
      <ul className="flex-1 overflow-hidden">
        {ROWS.map((row) => {
          const selected = row.n === SELECTED;
          return (
            <li
              key={row.n}
              className={cx(
                'flex h-8 items-center gap-2 border-b border-(--fd-line) border-l-2 pr-3 pl-2.5 text-[13px]/[18px]',
                selected ? 'border-l-(--fd-accent) bg-(--fd-accent-tint) text-(--fd-ink)' : 'border-l-transparent text-(--fd-ink-2)',
              )}
            >
              <span className="w-5 font-mono text-[12px] text-(--fd-ink-3) tabular-nums">{row.n}</span>
              <span className="min-w-0 flex-1 truncate">{row.cmd}</span>
              <span className="tabular-nums">{row.alt === null ? '—' : `${row.alt} m`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ProductMock({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The Flight Deck mission editor: a survey area with five lanes on the map, the waypoint list beside it and the route totals underneath."
      className={cx('overflow-hidden rounded-[6px] border border-(--fd-line) bg-(--fd-surface) text-(--fd-ink)', className)}
    >
      {/* header */}
      <div aria-hidden className="flex h-12 items-center gap-2 border-b border-(--fd-line) px-2 sm:px-3">
        <RiArrowLeftSLine className="size-5 shrink-0 text-(--fd-ink-3)" />
        <span className="min-w-0 truncate text-[14px]/[20px] font-medium">North field survey</span>
        <span className={cx(type.data, 'hidden text-[12px] text-(--fd-ink-3) sm:inline')}>Saved 12:04</span>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <RiArrowGoBackLine className="hidden size-4 text-(--fd-ink-2) sm:block" />
          <RiArrowGoForwardLine className="hidden size-4 text-(--fd-ink-3) sm:block" />
          <span className="hidden items-center gap-1.5 rounded-[6px] border border-(--fd-line) px-2 py-1 text-[12px]/[16px] text-(--fd-ink-2) sm:flex">
            <span className="size-1.5 rounded-full bg-(--fd-warn)" />
            <span className="tabular-nums">1 warning</span>
          </span>
          <span className="flex items-center gap-1 rounded-[6px] bg-(--fd-accent) px-2 py-1 text-[12px]/[16px] font-medium text-(--fd-accent-ink)">
            <RiDownload2Line className="size-3.5" />
            Export
          </span>
          <RiMore2Line className="size-4 text-(--fd-ink-2)" />
        </div>
      </div>

      {/* body */}
      <div aria-hidden className="flex h-[248px] sm:h-[360px] lg:h-[440px]">
        <div className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-(--fd-line) py-2 sm:w-12">
          {RAIL.map(({ icon: Icon, label, active }) => (
            <span
              key={label}
              className={cx(
                'flex size-8 items-center justify-center rounded-[6px]',
                active ? 'bg-(--fd-ink) text-(--fd-surface)' : 'text-(--fd-ink-2)',
              )}
            >
              <Icon className="size-[18px]" />
            </span>
          ))}
          <span className="my-1 h-px w-6 bg-(--fd-line)" />
          <span className="flex size-8 items-center justify-center text-(--fd-ink-2)">
            <RiStackLine className="size-[18px]" />
          </span>
          <span className="flex size-8 items-center justify-center text-(--fd-ink-2)">
            <RiFocus3Line className="size-[18px]" />
          </span>
        </div>
        <MapCanvas />
        <Inspector />
      </div>

      {/* status bar */}
      <div
        aria-hidden
        className="flex h-8 items-center overflow-hidden border-t border-(--fd-line) bg-(--fd-surface) text-[12px]/[16px] whitespace-nowrap text-(--fd-ink-2) tabular-nums [&>span]:border-r [&>span]:border-(--fd-line) [&>span]:px-3 [&>span:last-child]:border-r-0"
      >
        <span className="text-(--fd-ink)">3.42 km</span>
        <span>6 min 20 s</span>
        <span>12 items</span>
        <span className="hidden sm:inline">Max 60 m</span>
      </div>
    </div>
  );
}
