import { cx } from '@/utils/cx';

/** Small line-art route on map paper for the empty dashboard: takeoff square, three
 * numbered waypoints, dashed return. Hairline ink, accent only on the route. */
export function EmptyRouteFigure({ className }: { className?: string }) {
  const wps: [number, number][] = [
    [92, 46],
    [168, 70],
    [196, 128],
  ];
  return (
    <figure className={cx('m-0', className)} aria-hidden>
      <svg viewBox="0 0 240 160" className="block w-full rounded-sm bg-background-secondary-default">
        <defs>
          <pattern id="fd-empty-grat" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" className="fill-none stroke-separator-border" strokeWidth={1} />
          </pattern>
        </defs>
        <rect width="240" height="160" fill="url(#fd-empty-grat)" />
        <path
          d="M18 118c22-10 40-4 58-16s30-36 58-34 44 22 66 18 28-16 40-14"
          className="fill-none stroke-text-tertiary"
          strokeWidth={1}
          opacity={0.5}
        />
        <path
          d="M18 140c26-8 48-2 70-12s36-30 62-26 40 22 60 20 22-10 30-10"
          className="fill-none stroke-text-tertiary"
          strokeWidth={1}
          opacity={0.35}
        />
        <line x1="196" y1="128" x2="48" y2="122" className="stroke-text-tertiary" strokeWidth={1.25} strokeDasharray="3 4" />
        <polyline
          points={`48,122 ${wps.map((p) => p.join(',')).join(' ')}`}
          className="fill-none stroke-background-primary-default"
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={`48,122 ${wps.map((p) => p.join(',')).join(' ')}`}
          className="fill-none stroke-fd-accent"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <rect x="43" y="117" width="10" height="10" className="fill-text-primary" />
        {wps.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r={8} className="fill-background-primary-default stroke-text-primary" strokeWidth={1.25} />
            <text x={x} y={y + 3.2} textAnchor="middle" className="fill-text-primary font-mono text-[9px]">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
