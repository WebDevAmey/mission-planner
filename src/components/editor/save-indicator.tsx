'use client';

import { useState } from 'react';
import { RiErrorWarningLine } from '@remixicon/react';
import { useSaveStore } from '@/lib/store/save-store';
import { Button } from '@/components/base/buttons/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cx } from '@/utils/cx';
import { TONE_DOT, TONE_TEXT } from './editor-styles';

function clock(ts: number | null): string | null {
  if (ts == null) return null;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Header save state: "Saved 12:04" / Saving… / Unsaved changes / Not saved · Retry /
 * Changed elsewhere. Text carries the state; the dot only reinforces it. */
export function SaveIndicator({ className }: { className?: string }) {
  const { status, error, flush, overwrite, lastSavedAt } = useSaveStore();
  const [busy, setBusy] = useState(false);

  const reload = () => window.location.reload();
  const at = clock(lastSavedAt);

  return (
    <>
      <div className={cx('flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[13px] text-text-tertiary', className)} aria-live="polite">
        {status === 'saving' && <span>Saving…</span>}
        {status === 'pending' && <span>Unsaved changes</span>}
        {(status === 'saved' || (status === 'idle' && at)) && (
          <span>
            Saved{at && <span className="tabular-nums"> {at}</span>}
          </span>
        )}
        {status === 'error' && (
          <span className={cx('flex min-w-0 items-center gap-1.5', TONE_TEXT.danger)} title={error ?? undefined}>
            <RiErrorWarningLine className="size-3.5 shrink-0" aria-hidden />
            <span>Not saved</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await flush();
                setBusy(false);
              }}
              className="rounded-sm font-medium underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              Retry
            </button>
          </span>
        )}
        {status === 'conflict' && (
          <span className={cx('flex items-center gap-1.5', TONE_TEXT.warn)}>
            <span aria-hidden className={cx('size-1.5 rounded-full', TONE_DOT.warn)} /> Changed elsewhere
          </span>
        )}
      </div>

      <Dialog open={status === 'conflict'} onClose={() => undefined} size="sm">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-medium">This mission changed elsewhere</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-[14px] leading-relaxed text-text-secondary">
            Another tab or device saved a newer version. Reload to see it (your unsaved edits here are discarded), or
            overwrite it with what you see now.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" size="small" onClick={reload}>
            Reload
          </Button>
          <Button
            variant="primary"
            size="small"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await overwrite();
              setBusy(false);
            }}
          >
            Overwrite with mine
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
