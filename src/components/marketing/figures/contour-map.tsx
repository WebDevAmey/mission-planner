import { cx } from '@/utils/cx';
import styles from './figures.module.css';
import { hillContours, polyline, valleyLines, type Pt } from './geometry';

/**
 * The signature figure (DESIGN_SPEC D-10): a hand-built chart sheet with terrain
 * contours, a graticule and range rings from the launch point, in ink-3 at low
 * contrast, and one signal-orange route through numbered waypoints that draws
 * once. Server-rendered SVG, no JS. Sheet is 1200 × 900 units.
 */

const HILLS = [
  { cx: 930, cy: 300, r0: 16, step: 30, rings: 9, seed: 0.6, sx: 1.25, drift: [4, -3] as Pt },
  { cx: 210, cy: 650, r0: 26, step: 32, rings: 8, seed: 2.1, drift: [-3, 2] as Pt },
  { cx: 470, cy: 120, r0: 12, step: 28, rings: 6, seed: 4, sx: 1.4 },
  { cx: 1160, cy: 780, r0: 18, step: 30, rings: 6, seed: 1.3 },
  { cx: 620, cy: 820, r0: 10, step: 26, rings: 4, seed: 5.2, sx: 1.6 },
];

const CONTOURS = HILLS.flatMap((h) => hillContours(h).map((d, k) => ({ d, index: k % 4 === 3 })));
const VALLEYS = valleyLines(6, { x0: -40, x1: 1240, y: 470, gap: 18, amp: 26, seed: 1.1 });

const GRID = 120;
const GRATICULE = [
  ...Array.from({ length: 11 }, (_, i) => `M${(i + 0.5) * GRID} 0 V900`),
  ...Array.from({ length: 8 }, (_, i) => `M0 ${(i + 0.5) * GRID} H1200`),
].join(' ');

/** Launch point and the numbered waypoints the route visits. */
export const HOME: Pt = [700, 580];
const WAYPOINTS: Pt[] = [
  [652, 452],
  [744, 318],
  [892, 262],
  [1014, 336],
  [1046, 470],
  [928, 540],
];
const SELECTED = 3;
const ROUTE = polyline([HOME, ...WAYPOINTS]);
const RETURN = polyline([WAYPOINTS[WAYPOINTS.length - 1], HOME]);

const RINGS = [180, 360];

export function ContourMap({
  className,
  route = true,
  animate = true,
  preserveAspectRatio = 'xMidYMid slice',
  viewBox = '0 0 1200 900',
  routeClassName,
}: {
  className?: string;
  route?: boolean;
  animate?: boolean;
  preserveAspectRatio?: string;
  viewBox?: string;
  /** Lets a parent hide the route at some breakpoints (e.g. behind text on phones). */
  routeClassName?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      aria-hidden
      focusable="false"
      className={cx('block size-full select-none', className)}
    >
      {/* graticule */}
      <path d={GRATICULE} className="fill-none stroke-(--fd-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />

      {/* terrain */}
      <g className="fill-none stroke-(--fd-ink-3)" vectorEffect="non-scaling-stroke">
        {CONTOURS.map(({ d, index }, i) => (
          <path key={i} d={d} strokeWidth={index ? 1.1 : 0.8} opacity={index ? 0.42 : 0.26} vectorEffect="non-scaling-stroke" />
        ))}
        {VALLEYS.map((d, i) => (
          <path key={`v${i}`} d={d} strokeWidth="0.8" opacity="0.22" vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {route ? (
        <g className={routeClassName}>
          {/* range rings from launch */}
          <g className="fill-none stroke-(--fd-ink-3)" opacity="0.55">
            {RINGS.map((r) => (
              <circle key={r} cx={HOME[0]} cy={HOME[1]} r={r} strokeWidth="1" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
            ))}
            {[0, 90, 180, 270].map((deg) => {
              const a = (deg * Math.PI) / 180;
              const [x, y] = HOME;
              const r = RINGS[1];
              return (
                <path
                  key={deg}
                  d={`M${x + Math.cos(a) * (r - 8)} ${y + Math.sin(a) * (r - 8)} L${x + Math.cos(a) * (r + 8)} ${y + Math.sin(a) * (r + 8)}`}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
          <g className="fill-(--fd-ink-3) font-mono" fontSize="12" letterSpacing="0.06em">
            <text x={HOME[0] + RINGS[0] * 0.71 + 6} y={HOME[1] + RINGS[0] * 0.71 + 14}>
              500 M
            </text>
            <text x={HOME[0] + RINGS[1] * 0.71 + 6} y={HOME[1] + RINGS[1] * 0.71 + 14}>
              1 KM
            </text>
          </g>

          {/* return-to-launch leg */}
          <path d={RETURN} className="fill-none stroke-(--fd-ink-3)" strokeWidth="1.5" strokeDasharray="4 5" vectorEffect="non-scaling-stroke" />
          {/* route: surface casing, then the accent line */}
          <path d={ROUTE} className="fill-none stroke-(--fd-bg)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          <path
            d={ROUTE}
            pathLength={1}
            className={cx('fill-none stroke-(--fd-accent)', animate && styles.route)}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          <g>
            {/* launch: ink square */}
            <g className={cx(animate && styles.marker)}>
              <rect x={HOME[0] - 9} y={HOME[1] - 9} width="18" height="18" className="fill-(--fd-ink)" />
              <text x={HOME[0] + 16} y={HOME[1] + 4} fontSize="12" letterSpacing="0.06em" className="fill-(--fd-ink-2) font-mono">
                LAUNCH
              </text>
            </g>
            {WAYPOINTS.map(([x, y], i) => {
              const n = i + 1;
              const selected = n === SELECTED;
              return (
                <g key={n} className={cx(animate && styles.marker)}>
                  <circle
                    cx={x}
                    cy={y}
                    r="13"
                    className={selected ? 'fill-(--fd-accent) stroke-(--fd-accent)' : 'fill-(--fd-surface) stroke-(--fd-ink)'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={x}
                    y={y + 4.5}
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="500"
                    className={cx('font-mono', selected ? 'fill-(--fd-accent-ink)' : 'fill-(--fd-ink)')}
                  >
                    {n}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      ) : null}
    </svg>
  );
}
