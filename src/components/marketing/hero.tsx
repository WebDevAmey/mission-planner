import Link from 'next/link';
import { cx } from '@/utils/cx';
import { ContourMap } from './figures/contour-map';
import { ProductMock } from './product-mock';
import { button, grid, type, wrap } from './styles';

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      {/* The chart sheet sits behind the copy; the route is shown where it does not sit under text. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[640px] sm:h-[720px] lg:h-[760px]">
        <ContourMap preserveAspectRatio="xMaxYMin slice" routeClassName="max-lg:hidden" />
      </div>

      <div className={cx(wrap, 'relative pt-16 pb-16 sm:pt-24 lg:pt-28 lg:pb-24')}>
        <div className={grid}>
          <h1 id="hero-title" className={cx(type.display, 'col-span-4 max-w-[18ch] text-text-primary sm:col-span-12 lg:max-w-[20ch]')}>
            From an area on the map to a mission file you can&nbsp;fly.
          </h1>
          <div className="col-span-4 mt-6 flex flex-col gap-8 sm:col-span-8 lg:col-span-5 lg:mt-8">
            <p className={cx(type.lead, 'max-w-[44ch] text-text-secondary')}>
              Plan survey and waypoint missions, check every leg against zones and terrain, and export files Mission Planner
              and QGroundControl open as they are.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/signup" className={button.primary}>
                Start planning
              </Link>
              <a href="#how-it-works" className={button.secondary}>
                See how it works
              </a>
            </div>
            <p className={cx(type.small, 'text-text-tertiary')}>
              Free during beta. Runs in the browser. Built for ArduPilot vehicles.
            </p>
          </div>
        </div>

        <div className="fd-ticks relative mt-14 p-2 sm:mt-20 sm:p-3 lg:mt-24">
          <ProductMock />
        </div>
      </div>
    </section>
  );
}
