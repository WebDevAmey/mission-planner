'use client';

import {
  RiDownload2Line,
  RiForbid2Line,
  RiGridLine,
  RiLandscapeLine,
  RiRouteLine,
  RiSparkling2Line,
} from '@remixicon/react';
import { FeatureCard } from '@/components/arc/arc';
import { Section, SectionHeading } from './section';

const FEATURES = [
  {
    icon: RiGridLine,
    title: 'Survey grid generation',
    body: 'Draw a polygon and get a lawnmower pattern sized to your camera, altitude and overlap, with the lane angle chosen to keep turns to a minimum.',
  },
  {
    icon: RiRouteLine,
    title: 'Route optimisation',
    body: 'Reorder scattered waypoints into a shorter route while takeoff stays first, RTL stays last and attached commands stay with their waypoint. See the saving before you apply it.',
  },
  {
    icon: RiForbid2Line,
    title: 'No-fly zones and geofences',
    body: 'Keep-out and keep-in zones are checked against every leg, not just the waypoints, and the planner can route around them for you.',
  },
  {
    icon: RiLandscapeLine,
    title: 'Terrain clearance',
    body: 'Elevation along each leg is compared with your altitude frame, so a hillside between two waypoints shows up before the flight, not during it.',
  },
  {
    icon: RiDownload2Line,
    title: 'Exports that just open',
    body: 'QGroundControl .plan with fences, QGC WPL 110 .waypoints for Mission Planner, plus KML, GeoJSON and CSV for sharing and reports.',
  },
  {
    icon: RiSparkling2Line,
    title: 'Flight Deck AI',
    body: 'Describe the job in plain English and ATLAS drafts the mission. SENTINEL, a fixed set of rules rather than a model, checks it before anything reaches your plan.',
  },
];

export function Features() {
  return (
    <Section id="features" labelledBy="features-title" className="bg-background-secondary-default/40">
      <SectionHeading
        id="features-title"
        eyebrow="Features"
        title="Everything between the map and the autopilot"
        description="Planning tools that use proper geometry, with checks that run on every edit."
      />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <li key={f.title} className="min-w-0">
            <FeatureCard heading={f.title} description={f.body} className="block h-full">
              <span slot="icon" className="flex items-center justify-center">
                <f.icon className="size-5" aria-hidden />
              </span>
            </FeatureCard>
          </li>
        ))}
      </ul>
    </Section>
  );
}
