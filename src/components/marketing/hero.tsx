import Link from 'next/link';
import { cx } from '@/utils/cx';
import { ContourMap } from './figures/contour-map';
import { ProductMock } from './product-mock';
import { button, grid, type, wrap } from './styles';

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      {/* chart sheet behind the whole hero, terrain only */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] lg:h-[900px]">
        <ContourMap route={false} preserveAspectRatio="xMaxYMin slice" />
      </div>

      <div className={cx(wrap, 'relative pt-14 pb-16 sm:pt-20 lg:pt-24 lg:pb-24')}>
        <div className={cx(grid, 'items-start')}>
          <h1 id="hero-title" className={cx(type.display, 'col-span-4 max-w-[18ch] text-text-primary sm:col-span-12 lg:max-w-[20ch]')}>
            From an area on the map to a mission file you can&nbsp;fly.
          </h1>
          <div className="col-span-4 mt-6 flex flex-col gap-8 sm:col-span-8 lg:col-span-5 lg:mt-10">
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
            <p className={cx(type.small, 'text-text-tertiary')}>Free during beta. Runs in the browser. Built for ArduPilot vehicles.</p>
          </div>
          {/* signature: the route draws once through numbered waypoints */}
          <div aria-hidden className="hidden lg:col-span-6 lg:col-start-7 lg:-mt-6 lg:block">
            <ContourMap terrain={false} viewBox="540 200 600 420" preserveAspectRatio="xMidYMid meet" className="h-auto" />
          </div>
        </div>

        <div className="fd-ticks relative mt-14 p-2 sm:mt-20 sm:p-3 lg:mt-16">
          <ProductMock />
        </div>
      </div>
    </section>
  );
}
