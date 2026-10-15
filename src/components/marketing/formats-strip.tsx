'use client';

import { Marquee } from '@/components/arc/arc';

const ITEMS = [
  'Mission Planner',
  'QGroundControl',
  'ArduCopter',
  'ArduPlane',
  'MAVProxy',
  'QGC .plan',
  'QGC WPL 110 .waypoints',
  'KML',
  'GeoJSON',
  'CSV',
];

/** "Works with" strip, scrolled by ARC UI's marquee (pauses on hover). */
export function FormatsStrip() {
  return (
    <section aria-label="Compatible tools and formats" className="border-y border-separator-border bg-background-secondary-default/50 py-5">
      <p className="mb-3 px-4 text-center text-caption-1-semibold uppercase tracking-[0.12em] text-text-tertiary">
        Opens in the tools you already fly with
      </p>
      <Marquee speed={36} gap="2.5rem" className="block w-full">
        {ITEMS.map((item) => (
          <span key={item} className="text-headline-medium whitespace-nowrap text-text-secondary">
            {item}
          </span>
        ))}
      </Marquee>
    </section>
  );
}
