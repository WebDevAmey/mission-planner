import { RiCheckboxCircleLine, RiCloseCircleLine, RiErrorWarningLine, RiForbid2Line } from '@remixicon/react';
import { EXPORT_FORMATS } from '@/lib/domain/export';
import { cx } from '@/utils/cx';
import { type } from '../styles';
import { polyline, smoothOpen, type Pt } from './geometry';

/**
 * Pieces of the editor UI for the capabilities section, drawn with the app's
 * tokens and map colours. Numbers are an example mission, labelled as such.
 */

const mapGrid = 'fill-none stroke-(--fd-line)';

function MapGrid({ w, h, step = 40 }: { w: number; h: number; step?: number }) {
  const d = [
    ...Array.from({ length: Math.ceil(w / step) }, (_, i) => `M${i * step + step / 2} 0 V${h}`),
    ...Array.from({ length: Math.ceil(h / step) }, (_, i) => `M0 ${i * step + step / 2} H${w}`),
  ].join(' ');
  return <path d={d} className={mapGrid} strokeWidth="1" />;
}

function Readout({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px border-t border-(--fd-line) bg-(--fd-line) sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col gap-0.5 bg-(--fd-surface) px-3 py-2">
          <dt className={cx(type.label, 'text-text-tertiary')}>{it.label}</dt>
          <dd className="text-[14px]/[20px] text-text-primary tabular-nums">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* 1. Survey grid preview ------------------------------------------------- */

const FIELD: Pt[] = [
  [96, 40],
  [420, 28],
  [492, 176],
  [64, 196],
];
// Lanes clipped by hand to the field above.
const LANES: [Pt, Pt][] = Array.from({ length: 9 }, (_, i) => {
  const t = (i + 0.5) / 9;
  const left: Pt = [96 + (64 - 96) * t, 40 + (196 - 40) * t];
  const right: Pt = [420 + (492 - 420) * t, 28 + (176 - 28) * t];
  return i % 2 === 0 ? [left, right] : [right, left];
});

export function SurveyFragment() {
  return (
    <div className="overflow-hidden rounded-[6px] border border-(--fd-line) bg-(--fd-surface)">
      <svg viewBox="0 0 560 320" className="block h-auto w-full bg-(--fd-surface-2)" aria-hidden>
        <MapGrid w={560} h={320} />
        <g transform="translate(0 44)">
          <path
            d={`${polyline(FIELD)} Z`}
            className="fill-(--fd-info) stroke-(--fd-info)"
            fillOpacity="0.08"
            strokeWidth="1.25"
          />
          {LANES.map(([a, b], i) => (
            <path key={i} d={polyline([a, b])} className="fill-none stroke-(--fd-info)" strokeWidth="1" />
          ))}
          {FIELD.map(([x, y], i) => (
            <rect
              key={i}
              x={x - 4}
              y={y - 4}
              width="8"
              height="8"
              className="fill-(--fd-surface) stroke-(--fd-info)"
              strokeWidth="1.25"
            />
          ))}
          <text x="508" y="244" textAnchor="end" className="fill-(--fd-ink-3) font-mono" fontSize="11" letterSpacing="0.06em">
            LANE ANGLE 62°
          </text>
        </g>
      </svg>
      <Readout
        items={[
          { label: 'Area', value: '6.8 ha' },
          { label: 'Spacing', value: '24 m' },
          { label: 'Side overlap', value: '70%' },
          { label: 'Lanes', value: '9' },
        ]}
      />
    </div>
  );
}

/* 2. Route optimise: before / after -------------------------------------- */

const STOPS: Pt[] = [
  [20, 96],
  [62, 30],
  [150, 84],
  [96, 112],
  [180, 22],
  [128, 46],
  [196, 104],
];
const BEFORE = [0, 4, 3, 1, 6, 5, 2].map((i) => STOPS[i]);
const AFTER = [0, 1, 5, 4, 2, 6, 3].map((i) => STOPS[i]);

function MiniRoute({ points, label, distance, strong }: { points: Pt[]; label: string; distance: string; strong?: boolean }) {
  return (
    <figure className="flex min-w-0 flex-1 flex-col gap-2">
      <svg
        viewBox="0 0 216 128"
        className="block h-auto w-full rounded-[4px] border border-(--fd-line) bg-(--fd-surface-2)"
        aria-hidden
      >
        <path
          d={polyline(points)}
          className={strong ? 'fill-none stroke-(--fd-accent)' : 'fill-none stroke-(--fd-ink-3)'}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {points.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="4.5"
            className={i === 0 ? 'fill-(--fd-ink)' : 'fill-(--fd-surface) stroke-(--fd-ink)'}
            strokeWidth="1.25"
          />
        ))}
      </svg>
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className={cx(type.label, 'text-text-tertiary')}>{label}</span>
        <span className={cx('text-[15px]/[20px] tabular-nums', strong ? 'font-medium text-text-primary' : 'text-text-secondary')}>
          {distance}
        </span>
      </figcaption>
    </figure>
  );
}

export function OptimiseFragment() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 lg:flex-col">
        <MiniRoute points={BEFORE} label="Before" distance="4.82 km" />
        <MiniRoute points={AFTER} label="After" distance="3.61 km" strong />
      </div>
      <p className="flex items-baseline justify-between border-t border-(--fd-line) pt-2 text-[14px]/[20px] text-text-secondary">
        <span>Saved</span>
        <span className="text-text-primary tabular-nums">1.21 km (25%)</span>
      </p>
    </div>
  );
}

/* 3. Zone conflict on a leg ---------------------------------------------- */

export function ZoneFragment() {
  // Leg 7 → 8 passes through the zone between x≈118 and x≈202.
  return (
    <div className="overflow-hidden rounded-[6px] border border-(--fd-line) bg-(--fd-surface)">
      <svg viewBox="0 0 320 200" className="block h-auto w-full bg-(--fd-surface-2)" aria-hidden>
        <MapGrid w={320} h={200} />
        <circle
          cx="160"
          cy="104"
          r="56"
          className="fill-(--fd-danger) stroke-(--fd-danger)"
          fillOpacity="0.12"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />
        <path d="M40 76 L118 81" className="fill-none stroke-(--fd-accent)" strokeWidth="2.5" />
        <path d="M118 81 L202 86" className="fill-none stroke-(--fd-danger)" strokeWidth="2.5" strokeDasharray="6 3" />
        <path d="M202 86 L280 91" className="fill-none stroke-(--fd-accent)" strokeWidth="2.5" />
        {[
          [40, 76, 7],
          [280, 91, 8],
        ].map(([x, y, n]) => (
          <g key={n}>
            <circle cx={x} cy={y} r="10" className="fill-(--fd-surface) stroke-(--fd-ink)" strokeWidth="1.5" />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="500" className="fill-(--fd-ink) font-mono">
              {n}
            </text>
          </g>
        ))}
      </svg>
      <p className="flex items-start gap-2 border-t border-(--fd-line) px-3 py-2.5 text-[14px]/[20px] text-text-primary">
        <RiForbid2Line className="mt-0.5 size-4 shrink-0 text-(--fd-danger)" aria-hidden />
        <span>
          Leg 7 → 8 crosses keep-out zone “Airfield”
          <span className="block text-text-secondary">Route around adds 0.31 km</span>
        </span>
      </p>
    </div>
  );
}

/* 4. Terrain profile ------------------------------------------------------ */

const W = 520;
const H = 150;
const TERRAIN: Pt[] = [
  [0, 120],
  [60, 112],
  [120, 98],
  [180, 92],
  [240, 64],
  [280, 54],
  [320, 70],
  [380, 96],
  [440, 104],
  [520, 110],
];
const FLIGHT_Y = 30;
// Waypoint ticks along the profile.
const TICKS = [0, 110, 210, 340, 450];

export function TerrainFragment() {
  const terrain = smoothOpen(TERRAIN);
  return (
    <figure className="overflow-hidden rounded-[6px] border border-(--fd-line) bg-(--fd-surface)">
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="block h-auto w-full" aria-hidden>
        <path d={[0, 1, 2, 3].map((i) => `M0 ${20 + i * 33} H${W}`).join(' ')} className={mapGrid} strokeWidth="1" />
        {/* clearance limit band: flight altitude minus 40 m */}
        <path d={`M0 ${FLIGHT_Y} H${W}`} className="fill-none stroke-(--fd-ink)" strokeWidth="1.5" />
        <path d={`M0 ${FLIGHT_Y + 30} H${W}`} className="fill-none stroke-(--fd-ink-3)" strokeWidth="1" strokeDasharray="3 4" />
        <path d={`${terrain} L${W} ${H} L0 ${H} Z`} className="fill-(--fd-surface-2)" />
        <path d={terrain} className="fill-none stroke-(--fd-ink-3)" strokeWidth="1.25" />
        {/* where terrain rises above the clearance line */}
        <path
          d={`M232 ${FLIGHT_Y + 30} L 232 ${H}`}
          className="fill-none stroke-(--fd-warn)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <path
          d={`M304 ${FLIGHT_Y + 30} L 304 ${H}`}
          className="fill-none stroke-(--fd-warn)"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <path d={smoothOpen(TERRAIN.slice(4, 7))} className="fill-none stroke-(--fd-warn)" strokeWidth="2.5" />
        {TICKS.map((x, i) => (
          <g key={x}>
            <path d={`M${x} ${FLIGHT_Y - 6} V${FLIGHT_Y + 6}`} className="stroke-(--fd-ink)" strokeWidth="1.5" />
            <text
              x={Math.min(Math.max(x, 8), W - 8)}
              y={H + 18}
              textAnchor="middle"
              className="fill-(--fd-ink-3) font-mono"
              fontSize="11"
            >
              {i + 2}
            </text>
          </g>
        ))}
        <text x="8" y={FLIGHT_Y - 10} className="fill-(--fd-ink-2) font-mono" fontSize="11">
          60 m AGL
        </text>
        <text x={W - 8} y={FLIGHT_Y + 26} textAnchor="end" className="fill-(--fd-ink-3) font-mono" fontSize="11">
          LIMIT 40 m
        </text>
      </svg>
      <figcaption className="flex items-start gap-2 border-t border-(--fd-line) px-3 py-2.5 text-[14px]/[20px] text-text-primary">
        <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-(--fd-warn)" aria-hidden />
        <span>
          Clearance 34 m between waypoints 4 and 5 <span className="text-text-secondary">(limit 40 m)</span>
        </span>
      </figcaption>
    </figure>
  );
}

/* 5. Export menu ---------------------------------------------------------- */

export function ExportFragment() {
  const formats = Object.values(EXPORT_FORMATS);
  return (
    <div className="rounded-[10px] border border-(--fd-line) bg-(--fd-surface) p-1 shadow-fd-float">
      <ul aria-label="Export formats">
        {formats.map((f, i) => (
          <li
            key={f.format}
            className={cx('flex items-baseline gap-3 rounded-[6px] px-2.5 py-2', i === 0 && 'bg-(--fd-surface-3)')}
          >
            <span className={cx(type.data, 'w-[86px] shrink-0 text-text-primary')}>.{f.extension}</span>
            <span className="min-w-0 text-[14px]/[20px] text-text-secondary">{f.description}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 6. Checks list ---------------------------------------------------------- */

const CHECKS = [
  { tone: 'error', text: 'Leg 7 → 8 crosses keep-out zone “Airfield”' },
  { tone: 'warn', text: 'Terrain clearance 34 m between 4 and 5' },
  { tone: 'ok', text: 'Altitude within 0–120 m on every item' },
  { tone: 'ok', text: 'DO_JUMP targets exist and terminate' },
  { tone: 'ok', text: 'Endurance 14 min of a 22 min budget' },
] as const;

const TONE = {
  error: { icon: RiCloseCircleLine, cls: 'text-(--fd-danger)', label: 'Error' },
  warn: { icon: RiErrorWarningLine, cls: 'text-(--fd-warn)', label: 'Warning' },
  ok: { icon: RiCheckboxCircleLine, cls: 'text-(--fd-ok)', label: 'Pass' },
};

export function ChecksFragment() {
  return (
    <ul className="overflow-hidden rounded-[6px] border border-(--fd-line) bg-(--fd-surface)">
      {CHECKS.map((c) => {
        const t = TONE[c.tone];
        return (
          <li
            key={c.text}
            className="flex items-center gap-2.5 border-b border-(--fd-line) px-3 py-2 text-[14px]/[20px] last:border-b-0"
          >
            <t.icon className={cx('size-4 shrink-0', t.cls)} aria-hidden />
            <span className="sr-only">{t.label}: </span>
            <span className="min-w-0 flex-1 text-text-primary">{c.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
