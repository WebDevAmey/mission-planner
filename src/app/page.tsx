'use client';

import { useRouter } from 'next/navigation';
import { Bot, ShieldCheck, FileClock, Radar, ArrowRight, Gauge, Compass } from 'lucide-react';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { ScrollProgress } from '@/components/motion/scroll-progress';
import { ScrollReveal } from '@/components/motion/scroll-reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { TiltCard } from '@/components/motion/tilt-card';
import { Parallax } from '@/components/motion/parallax';
import { ButtonLink } from '@/components/motion/button/base';
import AnimatedButton from '@/components/ui/animated-button';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Capabilities', href: '#capabilities' },
];

const FEATURES = [
  {
    icon: Bot,
    title: 'Plan in plain English',
    body: "ATLAS turns a natural-language request — a target area, an inspection route, a patrol pattern — into a complete MAVLink waypoint list. Geocoding and terrain lookups run automatically when they're needed.",
  },
  {
    icon: ShieldCheck,
    title: "A veto gate that can't be talked out of it",
    body: 'SENTINEL is deterministic code, not a model. It checks geofences, terrain clearance, risk score, and endurance against fixed rules, and can block a mission outright — no prompt can argue its way past it.',
  },
  {
    icon: FileClock,
    title: 'Every decision, on the record',
    body: 'Each planning run — prompt, verdict, risk score, blockers — is logged on-device and exportable as JSON. The audit trail regulated operators need, without standing up a backend.',
  },
];

const STEPS = [
  { icon: Compass, title: 'Describe the mission', body: 'Tell Flight Deck what you need to fly — target area, altitude, mission type.' },
  { icon: Radar, title: 'SENTINEL audits the draft', body: 'Geofences, terrain, risk, and endurance are checked against fixed, inspectable rules.' },
  { icon: Gauge, title: 'You approve, nothing flies without it', body: 'A passed draft waits for your sign-off before it ever touches the mission plan.' },
];

const STATS = [
  { value: 40, suffix: '', label: 'waypoints per drafted mission' },
  { value: 5, suffix: '', label: 'independent safety checks per run' },
  { value: 65, suffix: '/100', label: 'risk score triggers an automatic veto' },
];

export default function LandingPage() {
  const router = useRouter();
  const goToApp = () => router.push('/mission-planner');

  return (
    <SmoothScroll className="bg-background text-foreground">
      <ScrollProgress variant="bar" position="top" className="bg-foreground" />

      {/* Nav */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/85 px-6 py-4 backdrop-blur-sm sm:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Bot size={14} className="text-primary-foreground" />
          </div>
          <span className="font-sans text-[15px] font-bold">Flight Deck</span>
        </div>
        <nav className="flex items-center gap-7">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hidden font-sans text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:inline">
              {l.label}
            </a>
          ))}
          <AnimatedButton onClick={goToApp} className="px-4 py-1.5 font-sans text-[13px] font-semibold">
            Launch Flight Deck <ArrowRight size={13} />
          </AnimatedButton>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-[860px] overflow-hidden px-6 pb-24 pt-28 text-center sm:pt-32">
        <Parallax speed={0.15} className="pointer-events-none absolute inset-x-0 top-0 -z-10 select-none text-center">
          <span className="font-mono text-[220px] font-bold leading-none text-muted opacity-40 sm:text-[320px]">FD</span>
        </Parallax>

        <ScrollReveal amount={0.6}>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="status-dot-active" /> ATLAS + SENTINEL agentic mission planning
          </div>
        </ScrollReveal>

        <TextReveal
          as="h1"
          text={['Plan drone missions in plain English.', 'Nothing flies until safety clears it.']}
          className="mb-5 font-sans text-[40px] font-bold leading-[1.1] tracking-tight sm:text-[52px]"
        />

        <ScrollReveal delay={0.15} amount={0.6}>
          <p className="mx-auto mb-9 max-w-[620px] font-sans text-[17px] leading-relaxed text-muted-foreground">
            Flight Deck drafts full MAVLink missions from a natural-language request, then runs
            them through a deterministic safety audit — geofences, terrain, risk, endurance —
            before you ever see an approve button. Offline-capable, ArduPilot-compatible, no
            black-box verdicts.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <AnimatedButton onClick={goToApp} className="px-7 py-3 font-sans text-sm font-semibold">
              Launch Flight Deck <ArrowRight size={15} />
            </AnimatedButton>
            <ButtonLink href="#how-it-works" variant="outline" size="lg" className="font-sans text-sm font-semibold">
              See how it works
            </ButtonLink>
          </div>
        </ScrollReveal>
      </section>

      {/* Stats */}
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-[900px] grid-cols-1 divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STATS.map((s) => (
            <ScrollReveal key={s.label} amount={0.6}>
              <div className="px-8 py-10 text-center">
                <div className="font-mono text-[34px] font-bold">
                  <AnimatedNumber value={s.value} />
                  {s.suffix}
                </div>
                <div className="mt-1 font-sans text-[12.5px] text-muted-foreground">{s.label}</div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section id="capabilities" className="mx-auto max-w-[1080px] px-6 py-24 sm:px-8">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <ScrollReveal key={f.title} delay={i * 0.08}>
              <TiltCard max={8} className="h-full border border-border bg-card p-6">
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                  <f.icon size={17} className="text-foreground" />
                </div>
                <h3 className="mb-2 font-sans text-[16px] font-bold">{f.title}</h3>
                <p className="font-sans text-[13.5px] leading-relaxed text-muted-foreground">{f.body}</p>
              </TiltCard>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1080px] px-6 py-24 sm:px-8">
          <ScrollReveal>
            <h2 className="mb-12 text-center font-sans text-[26px] font-bold">How a mission gets cleared</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <ScrollReveal key={s.title} delay={i * 0.1}>
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background">
                    <s.icon size={19} className="text-foreground" />
                  </div>
                  <div className="mb-1.5 font-mono text-[10px] text-muted-foreground">STEP {i + 1}</div>
                  <h3 className="mb-2 font-sans text-[15px] font-bold">{s.title}</h3>
                  <p className="font-sans text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[680px] px-6 py-24 text-center">
        <ScrollReveal>
          <h2 className="mb-3.5 font-sans text-[26px] font-bold">Ready to plan your next flight?</h2>
          <p className="mb-7 font-sans text-sm text-muted-foreground">
            Sign in with your operator password to open the mission planner.
          </p>
          <AnimatedButton onClick={goToApp} className="px-7 py-3 font-sans text-sm font-semibold">
            Launch Flight Deck <ArrowRight size={15} />
          </AnimatedButton>
        </ScrollReveal>
      </section>

      {/* Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-6 sm:px-8">
        <span className="font-mono text-[11px] text-muted-foreground">
          Flight Deck — offline-capable MAVLink mission planning
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">
          Built on ArduPilot / MAVLink
        </span>
      </footer>
    </SmoothScroll>
  );
}
