import { RiArrowRightLine, RiShieldCheckLine } from '@remixicon/react';
import { Chip } from '@/components/base/badges/chip';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { CtaLink } from './cta-link';
import { ProductMock } from './product-mock';

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden px-4 pt-12 pb-16 sm:px-6 sm:pt-20 lg:px-8">
      {/* soft grid + accent wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-separator-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-separator-border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[min(900px,120vw)] -translate-x-1/2 rounded-full bg-accent-600/20 blur-3xl"
      />

      <div className="relative mx-auto flex w-full max-w-[1200px] flex-col items-center gap-10 sm:gap-14">
        <div className="flex max-w-3xl flex-col items-center gap-6 text-center">
          <Chip variant="caption" color="blue" className="gap-1.5 rounded-full px-2.5">
            <span className="size-1.5 rounded-full bg-accent-400" aria-hidden />
            Free during beta · Built for ArduPilot
          </Chip>
          <h1
            id="hero-title"
            className="text-display-4-semibold text-balance text-text-primary sm:text-display-2-semibold lg:text-display-1-semibold"
          >
            From an area on the map to a mission file you can fly.
          </h1>
          <p className="max-w-2xl text-headline-regular text-pretty text-text-secondary sm:text-title-3-regular">
            Flight Deck draws survey grids, orders your route, checks every leg against no-fly zones and terrain, and exports
            files that Mission Planner and QGroundControl open as-is. The safety checks stay on screen, not buried.
          </p>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <CtaLink href="/signup" trailingIcon={RiArrowRightLine} className="h-11 px-4">
              Start planning free
            </CtaLink>
            <CtaLink href="#how-it-works" variant="secondary" className="h-11 px-4">
              See how it works
            </CtaLink>
          </div>
          <p className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
            <RiShieldCheckLine className="size-4" aria-hidden />
            No credit card. Runs in your browser. Your missions stay in your account.
          </p>
        </div>

        <ScrollReveal y={24} blur={6} amount={0.15} className="w-full">
          <ProductMock />
        </ScrollReveal>
      </div>
    </section>
  );
}
