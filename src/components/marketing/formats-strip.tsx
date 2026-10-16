import { EXPORT_FORMATS } from '@/lib/domain/export';
import { cx } from '@/utils/cx';
import { type, wrap } from './styles';

/** Extensions straight from the exporter, so the strip cannot drift from the product. */
export const FORMAT_EXTENSIONS = Object.values(EXPORT_FORMATS).map((f) => `.${f.extension}`);

/** Static "exports to" row (no marquee), bounded by hairlines. */
export function FormatsStrip() {
  return (
    <section id="formats" aria-labelledby="formats-title" className="scroll-mt-16 border-t border-(--fd-line) bg-(--fd-surface)">
      <div className={cx(wrap, 'flex flex-col gap-4 py-6 lg:flex-row lg:items-center lg:gap-8')}>
        <h2 id="formats-title" className={cx(type.body, 'shrink-0 font-medium text-text-primary')}>
          Exports to
        </h2>
        <ul className="flex flex-wrap gap-2" aria-label="Export file formats">
          {FORMAT_EXTENSIONS.map((ext) => (
            <li key={ext} className={cx(type.data, 'rounded-[2px] border border-(--fd-line) bg-(--fd-bg) px-2 py-1 text-text-primary')}>
              {ext}
            </li>
          ))}
        </ul>
        <p className={cx(type.body, 'text-text-secondary lg:ml-auto')}>Opens in Mission Planner and QGroundControl</p>
      </div>
    </section>
  );
}
