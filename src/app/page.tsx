import type { Metadata } from 'next';
import { FinalCta } from '@/components/marketing/cta';
import { Faq } from '@/components/marketing/faq';
import { Features } from '@/components/marketing/features';
import { FormatsStrip } from '@/components/marketing/formats-strip';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Safety } from '@/components/marketing/safety';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteNav } from '@/components/marketing/site-nav';

export const metadata: Metadata = {
  title: { absolute: 'Flight Deck — from an area on the map to a flight-ready mission file' },
  description:
    'Survey grids, route optimisation, no-fly zones, terrain clearance and exports for Mission Planner and QGroundControl. Free during beta.',
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-background-full text-text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-background-primary-default focus:px-3 focus:py-2 focus:text-body-medium"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <FormatsStrip />
        <HowItWorks />
        <Features />
        <Safety />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
