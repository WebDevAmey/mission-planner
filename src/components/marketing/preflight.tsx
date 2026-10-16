import { RiCheckLine, RiCloseCircleLine, RiErrorWarningLine } from '@remixicon/react';
import { cx } from '@/utils/cx';
import { SectionHeading } from './section';
import { section, type, wrap } from './styles';

type Cell = 'ok' | 'warn' | 'error';

const LEGS = ['1–2', '2–3', '3–4', '4–5', '5–6', '6–7', '7–8'];

/** Example mission: what one pass of the checks reports, leg by leg. */
const ROWS: { check: string; detail: string; cells: Cell[] | { summary: string; tone: Cell } }[] = [
  { check: 'Altitude limits', detail: 'Every item between your minimum and maximum', cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'] },
  { check: 'Terrain clearance', detail: 'Ground sampled along the leg, against your AGL minimum', cells: ['ok', 'ok', 'ok', 'warn', 'ok', 'ok', 'ok'] },
  { check: 'Zones', detail: 'Each leg intersected with keep-out and keep-in zones', cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'error'] },
  { check: 'Speed limit', detail: 'Commanded speeds against your maximum', cells: ['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'] },
  { check: 'Battery and time', detail: 'Estimated flight time against rated endurance', cells: { summary: '14 min of a 22 min budget', tone: 'ok' } },
  { check: 'Sequence and DO_JUMP', detail: 'Takeoff first, return last, jump targets valid and finite', cells: { summary: 'Valid', tone: 'ok' } },
];

const ICON = {
  ok: { icon: RiCheckLine, cls: 'text-(--fd-ink-3)', label: 'Pass' },
  warn: { icon: RiErrorWarningLine, cls: 'text-(--fd-warn)', label: 'Warning' },
  error: { icon: RiCloseCircleLine, cls: 'text-(--fd-danger)', label: 'Error' },
} as const;

function Mark({ tone }: { tone: Cell }) {
  const { icon: Icon, cls, label } = ICON[tone];
  return (
    <>
      <Icon className={cx('mx-auto size-[18px]', cls)} aria-hidden />
      <span className="sr-only">{label}</span>
    </>
  );
}

export function Preflight() {
  return (
    <section id="checks" aria-labelledby="checks-title" className={section}>
      <div className={wrap}>
        <SectionHeading id="checks-title" title="Pre-flight checks">
          They run on every edit, per leg rather than per waypoint, with fixed thresholds you set. Nothing to remember to press.
        </SectionHeading>

        <figure className="mt-12 lg:mt-16">
          <div className="overflow-x-auto rounded-[2px] border border-(--fd-line) bg-(--fd-surface)" tabIndex={0} aria-label="Checks by leg, example mission">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className={cx(type.label, 'border-b border-(--fd-line) bg-(--fd-surface-2) text-text-tertiary')}>
                  <th scope="col" className="w-[36%] px-4 py-3 font-medium sm:px-6">Check</th>
                  {LEGS.map((leg) => (
                    <th key={leg} scope="col" className="px-2 py-3 text-center font-medium tabular-nums">
                      <span className="sr-only">Leg </span>
                      {leg}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.check} className="border-b border-(--fd-line) last:border-b-0">
                    <th scope="row" className="px-4 py-3.5 font-normal sm:px-6">
                      <span className={cx(type.body, 'block text-text-primary')}>{row.check}</span>
                      <span className={cx(type.small, 'block text-text-secondary')}>{row.detail}</span>
                    </th>
                    {Array.isArray(row.cells) ? (
                      row.cells.map((cell, i) => (
                        <td key={i} className={cx('px-2 py-3.5 text-center', cell === 'warn' && 'bg-(--fd-warn)/10', cell === 'error' && 'bg-(--fd-danger)/10')}>
                          <Mark tone={cell} />
                        </td>
                      ))
                    ) : (
                      <td colSpan={LEGS.length} className="px-4 py-3.5">
                        <span className="flex items-center gap-2 text-[14px]/[20px] text-text-primary tabular-nums">
                          <span className="inline-flex">
                            <Mark tone={row.cells.tone} />
                          </span>
                          {row.cells.summary}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <figcaption className={cx(type.small, 'mt-4 flex flex-wrap gap-x-6 gap-y-2 text-text-secondary')}>
            <span>Example mission, eight waypoints.</span>
            <span className="inline-flex items-center gap-1.5">
              <RiErrorWarningLine className="size-4 text-(--fd-warn)" aria-hidden /> Warning: clearance 34 m, limit 40 m
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RiCloseCircleLine className="size-4 text-(--fd-danger)" aria-hidden /> Error: leg crosses a keep-out zone
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
