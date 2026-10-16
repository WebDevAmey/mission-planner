'use client';

import { Accordion, AccordionItem } from '@/components/arc/arc';
import { cx } from '@/utils/cx';
import { grid, section, type, wrap } from './styles';

export const FAQS = [
  {
    q: 'Which ground stations and autopilots does it work with?',
    a: 'Flight Deck plans for ArduPilot vehicles. Export a QGroundControl .plan or a QGC WPL 110 .waypoints file, open it in QGroundControl, Mission Planner or MAVProxy, then upload it to your flight controller as usual.',
  },
  {
    q: 'Is it free?',
    a: 'Yes, during the beta. Planning, checks and every export format are free. We will give plenty of notice before introducing any paid plan, and missions you have made stay yours.',
  },
  {
    q: 'What exactly gets checked?',
    a: 'Each leg is tested against your keep-out and keep-in zones and the terrain along it, plus altitude and speed limits, the mission sequence and DO_JUMP targets, and an endurance budget. Findings appear in the Checks tab with the waypoint to fix.',
  },
  {
    q: 'Can I bring in missions I already have?',
    a: 'Yes. Import a QGroundControl .plan, a QGC WPL 110 .waypoints file or a Flight Deck .json backup, and keep editing from there.',
  },
  {
    q: 'Is there an assistant?',
    a: 'Yes, and it is optional. Describe the job and it drafts a mission; the same pre-flight checks run on the draft, and nothing changes in your plan until you approve it. It needs an API key. Everything else works without one.',
  },
  {
    q: 'How is my account protected?',
    a: 'Passwords are hashed with Argon2id, sessions are stored as hashed tokens, and resetting your password signs out every other session.',
  },
];

/** ARC accordion, re-skinned through its custom properties: hairlines, square, Geist. */
const accordionSkin = [
  '[--border-subtle:var(--fd-line)] [--radius-lg:2px]',
  '[--surface-raised:var(--fd-surface)] [--surface-overlay:var(--fd-surface-2)] [--divider-glow:var(--fd-ink-3)]',
  '[--text-primary:var(--fd-ink)] [--text-secondary:var(--fd-ink-2)] [--text-muted:var(--fd-ink-3)]',
  '[--font-body:var(--font-sans)] [--font-label-weight:500] [--text-md:17px] [--text-sm:16px] [--body-lh:1.5]',
  '[--space-lg:20px] [--space-md:20px] [--interactive-hover:none]',
  '[--interactive-focus-inset:inset_0_0_0_2px_var(--fd-accent)]',
].join(' ');

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={section}>
      <div className={cx(wrap, grid, 'gap-y-10')}>
        <div className="col-span-4 flex flex-col gap-4 sm:col-span-12 lg:col-span-4">
          <h2 id="faq-title" className={cx(type.head, 'text-text-primary')}>
            Questions
          </h2>
          <p className={cx(type.body, 'max-w-[32ch] text-text-secondary')}>
            Something else? Sign up and use the feedback link in the app.
          </p>
        </div>
        <Accordion className={cx('col-span-4 block min-w-0 sm:col-span-12 lg:col-span-7 lg:col-start-6', accordionSkin)}>
          {FAQS.map((f) => (
            <AccordionItem key={f.q} question={f.q}>
              {f.a}
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
