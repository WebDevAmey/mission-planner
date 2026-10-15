'use client';

import { RiCheckboxCircleFill, RiCloseCircleFill, RiErrorWarningFill } from '@remixicon/react';
import { Chip } from '@/components/base/badges/chip';
import { AnimatedNumber } from '@/components/arc/arc';
import { Section, SectionHeading } from './section';

const CHECKS = [
  {
    icon: RiCloseCircleFill,
    tone: 'text-status-rose-text',
    chip: 'rose' as const,
    level: 'Error',
    text: 'Leg 7 → 8 crosses no-fly zone “Airfield”',
    hint: 'Select to jump to waypoint 7, or let the planner route around it.',
  },
  {
    icon: RiErrorWarningFill,
    tone: 'text-status-yellow-text',
    chip: 'yellow' as const,
    level: 'Warning',
    text: 'Terrain clearance 34 m between WP 4 and 5',
    hint: 'Your minimum is 40 m. Raise the leg or change the altitude frame.',
  },
  {
    icon: RiCheckboxCircleFill,
    tone: 'text-status-lime-text',
    chip: 'lime' as const,
    level: 'Pass',
    text: 'Endurance 14 min of a 22 min battery budget',
    hint: 'Includes the return leg and a reserve you set.',
  },
  {
    icon: RiCheckboxCircleFill,
    tone: 'text-status-lime-text',
    chip: 'lime' as const,
    level: 'Pass',
    text: 'All legs inside the geofence',
    hint: 'Checked along each segment, not just at waypoints.',
  },
];

const STATS = [
  { value: 5, suffix: '', label: 'export formats' },
  { value: 100, suffix: '%', label: 'of legs checked, not only waypoints' },
  { value: 0, suffix: '', label: 'AI drafts applied without your approval' },
];

export function Safety() {
  return (
    <Section id="safety" labelledBy="safety-title">
      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-8">
          <SectionHeading
            id="safety-title"
            align="start"
            eyebrow="Safety, visible"
            title="Checks you can see, explained in plain words"
            description="Every edit re-runs the checks. Each finding names the waypoint, says why it matters and how to fix it. Colour is never the only signal."
          />
          <div className="rounded-2xl border border-separator-border bg-background-secondary-default p-5">
            <p className="text-body-medium text-text-primary">ATLAS drafts. SENTINEL decides.</p>
            <p className="mt-1 text-body-regular text-text-secondary">
              The AI assistant only ever proposes a mission. SENTINEL&apos;s audit is deterministic code with fixed thresholds, so no
              prompt can talk its way past a blocker, and nothing is written to your plan until you approve it.
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-2xl bg-background-secondary-default p-4">
                <dt className="order-2 text-caption-1-medium text-text-secondary">{s.label}</dt>
                <dd className="order-1 text-title-1-semibold text-text-primary tabular-nums">
                  <AnimatedNumber value={s.value} suffix={s.suffix} duration={1200} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-separator-border bg-background-secondary-default">
          <div className="flex items-center justify-between border-b border-separator-border px-5 py-3">
            <p className="text-body-medium text-text-primary">Checks · North field survey</p>
            <Chip variant="caption" color="rose">
              1 error · 1 warning
            </Chip>
          </div>
          <ul className="flex flex-col divide-y divide-separator-border">
            {CHECKS.map((c) => (
              <li key={c.text} className="flex gap-3 px-5 py-4">
                <c.icon className={`mt-0.5 size-5 shrink-0 ${c.tone}`} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body-medium text-text-primary">{c.text}</p>
                    <Chip variant="caption" color={c.chip}>
                      {c.level}
                    </Chip>
                  </div>
                  <p className="text-body-regular text-text-secondary">{c.hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
