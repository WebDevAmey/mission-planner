import type { ComponentType } from 'react';
import { cx } from '@/utils/cx';
import { ChecksFragment, ExportFragment, OptimiseFragment, SurveyFragment, TerrainFragment, ZoneFragment } from './figures/fragments';
import { SectionHeading } from './section';
import { section, type, wrap } from './styles';

const ITEMS: { title: string; body: string; figure: ComponentType; span: string; tone: 'surface' | 'bg' }[] = [
  {
    title: 'Survey grids',
    body: 'Draw a polygon and get lanes sized to your camera, altitude and overlap, at the angle with the fewest turns.',
    figure: SurveyFragment,
    span: 'lg:col-span-4',
    tone: 'surface',
  },
  {
    title: 'Shorter routes',
    body: 'Reorder scattered waypoints; takeoff stays first and return-to-launch stays last. See the saving before you apply it.',
    figure: OptimiseFragment,
    span: 'lg:col-span-2',
    tone: 'bg',
  },
  {
    title: 'Zones on every leg',
    body: 'Keep-out and keep-in zones are tested along each leg, not only at the waypoints.',
    figure: ZoneFragment,
    span: 'lg:col-span-2',
    tone: 'bg',
  },
  {
    title: 'Terrain clearance',
    body: 'Elevation along each leg is compared with your altitude, so a ridge between two waypoints shows up before the flight.',
    figure: TerrainFragment,
    span: 'lg:col-span-4',
    tone: 'surface',
  },
  {
    title: 'Exports that open',
    body: 'Six formats from one mission, with zones and rally points carried into the .plan file.',
    figure: ExportFragment,
    span: 'lg:col-span-3',
    tone: 'surface',
  },
  {
    title: 'A checks list you can act on',
    body: 'Each finding names the waypoint or leg, says why it matters and selects it on the map.',
    figure: ChecksFragment,
    span: 'lg:col-span-3',
    tone: 'bg',
  },
];

export function Capabilities() {
  return (
    <section id="capabilities" aria-labelledby="capabilities-title" className={section}>
      <div className={wrap}>
        <SectionHeading id="capabilities-title" title="What it does for you">
          Planning tools that use real geometry, with checks that run on every edit.
        </SectionHeading>
        <ul className="mt-12 grid gap-px border border-(--fd-line) bg-(--fd-line) md:grid-cols-2 lg:mt-16 lg:grid-cols-6">
          {ITEMS.map((item) => (
            <li
              key={item.title}
              className={cx(
                'flex min-w-0 flex-col gap-6 p-5 sm:p-6 lg:p-8',
                item.tone === 'surface' ? 'bg-(--fd-surface)' : 'bg-(--fd-bg)',
                item.span,
                (item.span === 'lg:col-span-4') && 'md:col-span-2',
              )}
            >
              <div className="flex max-w-[48ch] flex-col gap-2">
                <h3 className={cx(type.title3, 'text-text-primary')}>{item.title}</h3>
                <p className={cx(type.body, 'text-text-secondary')}>{item.body}</p>
              </div>
              <div className="mt-auto">
                <item.figure />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
