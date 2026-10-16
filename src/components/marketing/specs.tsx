import { EXPORT_FORMATS } from '@/lib/domain/export';
import { DEFAULT_FLIGHT_MODEL } from '@/lib/domain/metrics';
import { MAX_MISSION_ITEMS, MAX_MISSION_ZONES } from '@/lib/validation/mission';
import { cx } from '@/utils/cx';
import { grid, section, type, wrap } from './styles';

const nf = new Intl.NumberFormat('en-GB');
const m = DEFAULT_FLIGHT_MODEL;

/**
 * Product limits and model constants, read from the code that enforces them
 * so the figure cannot drift. CHECK_RULES counts the IssueCode union in
 * src/lib/domain/validate/types.ts.
 */
const CHECK_RULES = 21;

const ROWS: { label: string; value: string; note: string }[] = [
  { label: 'Mission items', value: nf.format(MAX_MISSION_ITEMS), note: 'Waypoints and commands per mission' },
  { label: 'Zones', value: nf.format(MAX_MISSION_ZONES), note: 'Keep-out, keep-in and no-fly, circle or polygon' },
  { label: 'Export formats', value: String(Object.keys(EXPORT_FORMATS).length), note: Object.values(EXPORT_FORMATS).map((f) => `.${f.extension}`).join('  ') },
  { label: 'Import formats', value: '3', note: '.plan  .waypoints  .json' },
  { label: 'Check rules', value: String(CHECK_RULES), note: 'Structure, limits, zones, terrain, endurance, DO_JUMP' },
  {
    label: 'Time model',
    value: `${m.accelMs2} m/s²`,
    note: `Acceleration per leg, ${m.climbRateMs} m/s climb, ${m.descentRateMs} m/s descent`,
  },
];

export function Specs() {
  return (
    <section id="limits" aria-labelledby="limits-title" className={section}>
      <div className={cx(wrap, grid, 'gap-y-10')}>
        <div className="col-span-4 flex flex-col gap-4 sm:col-span-12 lg:col-span-4">
          <h2 id="limits-title" className={cx(type.head, 'max-w-[12ch] text-text-primary')}>
            The numbers
          </h2>
          <p className={cx(type.lead, 'max-w-[36ch] text-text-secondary')}>
            Limits the editor and the API enforce today, and the model behind every time estimate.
          </p>
        </div>
        <figure className="col-span-4 sm:col-span-12 lg:col-span-7 lg:col-start-6">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className={cx(type.label, 'border-b border-(--fd-line-strong) text-text-tertiary')}>
                <th scope="col" className="pb-3 font-medium">Item</th>
                <th scope="col" className="pb-3 text-right font-medium sm:text-left">Value</th>
                <th scope="col" className="hidden pb-3 font-medium sm:table-cell">Detail</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.label} className="border-b border-(--fd-line) align-baseline">
                  <th scope="row" className={cx(type.body, 'py-4 pr-4 font-normal text-text-secondary')}>
                    {row.label}
                    <span className={cx(type.small, 'mt-1 block text-text-tertiary sm:hidden')}>{row.note}</span>
                  </th>
                  <td className="py-4 pr-4 text-right text-[24px]/[30px] font-medium tracking-[-0.015em] whitespace-nowrap text-text-primary tabular-nums sm:text-left">
                    {row.value}
                  </td>
                  <td className={cx(type.small, 'hidden py-4 text-text-secondary sm:table-cell', row.note.startsWith('.') && 'font-mono')}>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption className={cx(type.label, 'mt-4 text-text-tertiary')}>Fig. 1  Limits and defaults in the current release</figcaption>
        </figure>
      </div>
    </section>
  );
}
