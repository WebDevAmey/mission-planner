import Link from 'next/link';
import { cx } from '@/utils/cx';
import { ContourMap } from './figures/contour-map';
import { button, section, type, wrap } from './styles';

export function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className={section}>
      <div className={wrap}>
        <div className="fd-ticks relative border border-(--fd-line) bg-(--fd-surface)">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 overflow-hidden md:block">
            <ContourMap route={false} preserveAspectRatio="xMinYMid slice" viewBox="620 140 520 420" />
          </div>
          <div className="relative flex flex-col items-start gap-6 px-5 py-12 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
            <h2 id="cta-title" className={cx(type.head, 'max-w-[14ch] text-text-primary')}>
              Plan the next flight
            </h2>
            <p className={cx(type.lead, 'max-w-[36ch] text-text-secondary')}>
              Create an account, draw an area and export a checked mission file. No install, no card.
            </p>
            <Link href="/signup" className={button.primary}>
              Start planning
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
