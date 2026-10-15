'use client';

import { RiArrowRightLine } from '@remixicon/react';
import { CtaBanner } from '@/components/arc/arc';
import { CtaLink } from './cta-link';

export function FinalCta() {
  return (
    <section aria-label="Get started" className="px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1200px] overflow-hidden rounded-3xl border border-separator-border bg-background-secondary-default">
        <CtaBanner eyebrow="Free during beta" headline="Plan your next flight in minutes" className="block">
          <p>Create an account, draw an area and export a checked mission file. No install, no credit card.</p>
          <div slot="actions" className="flex flex-col gap-3 sm:flex-row">
            <CtaLink href="/signup" trailingIcon={RiArrowRightLine} className="h-11 px-4">
              Create your free account
            </CtaLink>
            <CtaLink href="/login" variant="secondary" className="h-11 px-4">
              Sign in
            </CtaLink>
          </div>
        </CtaBanner>
      </div>
    </section>
  );
}
