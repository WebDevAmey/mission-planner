import type { ComponentType } from 'react';
import { cx } from '@/utils/cx';
import { CheckDiagram, DrawDiagram, ExportDiagram } from './figures/step-diagrams';
import { SectionHeading } from './section';
import { section, type, wrap } from './styles';

const STEPS: { title: string; body: string; figure: ComponentType }[] = [
  {
    title: 'Draw',
    body: 'Outline the survey area or drop waypoints on the map. Altitude, speed and overlap are set once as mission defaults.',
    figure: DrawDiagram,
  },
  {
    title: 'Check',
    body: 'Every leg is tested against your zones, terrain and limits on each edit. Findings name the waypoint to fix.',
    figure: CheckDiagram,
  },
  {
    title: 'Export',
    body: 'Download a .plan for QGroundControl or a .waypoints file for Mission Planner, then upload it as usual.',
    figure: ExportDiagram,
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className={section}>
      <div className={wrap}>
        <SectionHeading id="how-title" title="How a mission comes together">
          One map view, start to finish. No desktop install and no plugin chain.
        </SectionHeading>
        <ol className="mt-12 grid border-t border-(--fd-line) md:grid-cols-3 lg:mt-16">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className={cx(
                'flex flex-col gap-4 border-b border-(--fd-line) py-8 md:border-b-0 md:px-6 md:pt-8 md:pb-0',
                i > 0 && 'md:border-l',
                i === 0 && 'md:pl-0',
                i === STEPS.length - 1 && 'border-b-0 md:pr-0',
              )}
            >
              <div className="rounded-[2px] border border-(--fd-line) bg-(--fd-surface)">
                <step.figure />
              </div>
              <h3 className={cx(type.title2, 'mt-2 flex items-baseline gap-3 text-text-primary')}>
                <span className="text-[15px] font-normal text-text-tertiary tabular-nums" aria-hidden>
                  {i + 1}
                </span>
                {step.title}
              </h3>
              <p className={cx(type.body, 'max-w-[40ch] text-text-secondary')}>{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
