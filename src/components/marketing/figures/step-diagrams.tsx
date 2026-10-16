import { polyline, type Pt } from './geometry';

/**
 * Line diagrams for Draw / Check / Export (DESIGN_SPEC §5.1 item 5):
 * hairline, monochrome, accent only on the route. 320 × 200 units each.
 */

const frame = 'block h-auto w-full';
const ink = 'fill-none stroke-(--fd-ink-2)';
const faint = 'fill-none stroke-(--fd-ink-3)';
const route = 'fill-none stroke-(--fd-accent)';

function Grid() {
  return (
    <path
      d={[...Array.from({ length: 7 }, (_, i) => `M${i * 48 + 16} 0 V200`), ...Array.from({ length: 4 }, (_, i) => `M0 ${i * 48 + 28} H320`)].join(' ')}
      className="fill-none stroke-(--fd-line)"
      strokeWidth="1"
    />
  );
}

const AREA: Pt[] = [
  [70, 52],
  [214, 40],
  [262, 132],
  [112, 160],
];

export function DrawDiagram() {
  return (
    <svg viewBox="0 0 320 200" className={frame} aria-hidden>
      <Grid />
      <path d={`${polyline(AREA.slice(0, 3))}`} className={ink} strokeWidth="1.25" />
      <path d={polyline([AREA[2], AREA[3], AREA[0]])} className={faint} strokeWidth="1.25" strokeDasharray="4 4" />
      {AREA.map(([x, y], i) => (
        <rect key={i} x={x - 4} y={y - 4} width="8" height="8" className="fill-(--fd-surface) stroke-(--fd-ink)" strokeWidth="1.25" />
      ))}
      {/* pointer at the vertex being placed */}
      <path d="M112 160 l0 18 l5 -5 l4 9 l3 -1.5 l-4 -8.5 l7 0 Z" className="fill-(--fd-surface) stroke-(--fd-ink)" strokeWidth="1" strokeLinejoin="round" />
      <text x="232" y="176" className="fill-(--fd-ink-3) font-mono" fontSize="10" letterSpacing="0.06em">
        4 VERTICES
      </text>
    </svg>
  );
}

const LEG: Pt[] = [
  [40, 150],
  [116, 60],
  [212, 56],
  [282, 140],
];

export function CheckDiagram() {
  return (
    <svg viewBox="0 0 320 200" className={frame} aria-hidden>
      <Grid />
      {/* keep-out zone */}
      <circle cx="166" cy="128" r="40" className={faint} strokeWidth="1.25" strokeDasharray="3 4" />
      <text x="166" y="132" textAnchor="middle" className="fill-(--fd-ink-3) font-mono" fontSize="10" letterSpacing="0.06em">
        KEEP-OUT
      </text>
      {/* the straight leg that would cross it */}
      <path d="M40 150 L 282 140" className={faint} strokeWidth="1" strokeDasharray="2 4" />
      <path d={polyline(LEG)} className={route} strokeWidth="2" strokeLinejoin="round" />
      {LEG.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" className="fill-(--fd-surface) stroke-(--fd-ink)" strokeWidth="1.25" />
      ))}
      {/* clearance dimension */}
      <path d="M166 88 V 62" className={ink} strokeWidth="1" />
      <path d="M161 88 H171 M161 62 H171" className={ink} strokeWidth="1" />
      <text x="176" y="80" className="fill-(--fd-ink-2) font-mono" fontSize="10">
        40 m
      </text>
    </svg>
  );
}

export function ExportDiagram() {
  return (
    <svg viewBox="0 0 320 200" className={frame} aria-hidden>
      <Grid />
      {/* mission file */}
      <path d="M40 36 H112 L132 56 V164 H40 Z" className="fill-(--fd-surface) stroke-(--fd-ink-2)" strokeWidth="1.25" />
      <path d="M112 36 V56 H132" className={ink} strokeWidth="1.25" />
      <path d={polyline([[56, 140], [70, 100], [96, 116], [116, 80]])} className={route} strokeWidth="2" strokeLinejoin="round" />
      <text x="52" y="60" className="fill-(--fd-ink) font-mono" fontSize="11">
        .plan
      </text>
      {/* hand-off */}
      <path d="M146 100 H 194" className={ink} strokeWidth="1.25" />
      <path d="M188 95 L194 100 L188 105" className={ink} strokeWidth="1.25" />
      {/* ground station */}
      <rect x="208" y="58" width="80" height="62" className="fill-(--fd-surface) stroke-(--fd-ink-2)" strokeWidth="1.25" />
      <path d="M232 120 V134 M264 120 V134 M220 134 H276" className={ink} strokeWidth="1.25" />
      <path d={polyline([[218, 108], [232, 82], [252, 94], [276, 70]])} className={faint} strokeWidth="1.25" />
      <text x="248" y="158" textAnchor="middle" className="fill-(--fd-ink-3) font-mono" fontSize="10" letterSpacing="0.06em">
        GROUND STATION
      </text>
    </svg>
  );
}
