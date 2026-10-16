'use client';

import { useEffect } from 'react';
import { button } from '@/components/marketing/styles';
import { SystemState } from '@/components/marketing/system-state';

export default function RouteError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <SystemState
      code={error.digest ? `Error ${error.digest}` : 'Error'}
      title="Something went wrong"
      action={
        <button type="button" onClick={() => (unstable_retry ?? reset)()} className={button.primary}>
          Try again
        </button>
      }
    >
      This page hit an error while loading. Try again, and reload if it persists.
    </SystemState>
  );
}
