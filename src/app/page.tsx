import type { Metadata } from 'next';
import { Capabilities } from '@/components/marketing/capabilities';
import { FinalCta } from '@/components/marketing/cta';
import { Faq } from '@/components/marketing/faq';
import { FormatsStrip } from '@/components/marketing/formats-strip';
import { Hero } from '@/components/marketing/hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Preflight } from '@/components/marketing/preflight';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteNav } from '@/components/marketing/site-nav';
import { Specs } from '@/components/marketing/specs';

export const metadata: Metadata = {
  title: { absolute: 'Flight Deck: from an area on the map to a mission file you can fly' },
  description:
    'Plan survey and waypoint missions, check every leg against zones and terrain, and export files Mission Planner and QGroundControl open. Free during beta.',
};

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-(--fd-bg) text-text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-[2px] focus:bg-(--fd-surface) focus:px-3 focus:py-2 focus:text-[14px] focus:outline-2 focus:outline-(--fd-accent)"
      >
        Skip to content
      </a>
      <SiteNav />
      <main id="main">
        <Hero />
        <FormatsStrip />
        <HowItWorks />
        <Capabilities />
        <Specs />
        <Preflight />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}
