'use client';

import { Accordion, AccordionItem } from '@/components/arc/arc';
import { Section, SectionHeading } from './section';

export const FAQS = [
  {
    q: 'Which ground stations and autopilots does it work with?',
    a: 'Flight Deck plans for ArduPilot vehicles. Export a QGroundControl .plan or a QGC WPL 110 .waypoints file and open it in QGroundControl, Mission Planner or MAVProxy, then upload it to your flight controller as usual.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes, during the beta. Planning, checks and every export format are free. We will give plenty of notice before introducing any paid plan, and missions you have made stay yours.',
  },
  {
    q: 'What exactly gets checked?',
    a: 'Each leg is tested against your keep-out and keep-in zones, terrain clearance along the leg, altitude and speed limits, and an endurance budget. Findings appear in the Checks tab with the waypoint to fix.',
  },
  {
    q: 'Can the AI change my mission on its own?',
    a: 'No. ATLAS only produces a draft. SENTINEL checks it with fixed rules, and nothing is written to your mission until you review the findings and approve it.',
  },
  {
    q: 'Do I need an API key?',
    a: 'Only for Flight Deck AI. Drawing areas, editing waypoints, the checks and all exports work without one.',
  },
  {
    q: 'How is my account protected?',
    a: 'Passwords are hashed with Argon2id, sessions are stored as hashed tokens, and resetting your password signs out every other session.',
  },
];

export function Faq() {
  return (
    <Section id="faq" labelledBy="faq-title" className="bg-background-secondary-default/40">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
        <SectionHeading
          id="faq-title"
          align="start"
          eyebrow="FAQ"
          title="Questions operators ask"
          description="Something else? Sign up and use the feedback link in the app."
        />
        <Accordion className="block min-w-0">
          {FAQS.map((f) => (
            <AccordionItem key={f.q} question={f.q}>
              {f.a}
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
