import type { Metadata } from 'next';
import Link from 'next/link';
import { button } from '@/components/marketing/styles';
import { SystemState } from '@/components/marketing/system-state';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <SystemState
      code="404"
      title="Off the map"
      action={
        <Link href="/" className={button.primary}>
          Go to the home page
        </Link>
      }
    >
      There is no page at this address. It may have moved, or the link is mistyped.
    </SystemState>
  );
}
