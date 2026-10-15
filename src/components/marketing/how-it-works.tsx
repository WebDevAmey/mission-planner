import { RiDownload2Line, RiPencilRuler2Line, RiShieldCheckLine } from '@remixicon/react';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { Section, SectionHeading } from './section';

const STEPS = [
  {
    icon: RiPencilRuler2Line,
    title: 'Outline the job',
    body: 'Search a place, then draw the survey area or drop waypoints on the map. Set altitude, speed and overlap once as mission defaults.',
  },
  {
    icon: RiShieldCheckLine,
    title: 'Generate and check',
    body: 'Flight Deck builds the survey grid, orders the route and runs its checks on every leg. Problems appear in the Checks tab and on the map, with the waypoint to fix.',
  },
  {
    icon: RiDownload2Line,
    title: 'Export and fly',
    body: 'Download a .plan for QGroundControl or a .waypoints file for Mission Planner, or share the route as KML, GeoJSON or CSV.',
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-title">
      <SectionHeading
        id="how-title"
        eyebrow="How it works"
        title="Three steps, one screen"
        description="No desktop install and no plugin chain. Plan, check and export in the same map view."
      />
      <ol className="mt-12 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title}>
            <ScrollReveal delay={i * 0.08} className="h-full">
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-separator-border bg-background-secondary-default p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-2lg bg-accent-500/15 text-accent-300">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-mono text-caption-1-medium text-text-tertiary tabular-nums">0{i + 1}</span>
                </div>
                <h3 className="text-title-3-semibold text-text-primary">{step.title}</h3>
                <p className="text-body-regular text-text-secondary">{step.body}</p>
              </div>
            </ScrollReveal>
          </li>
        ))}
      </ol>
    </Section>
  );
}
