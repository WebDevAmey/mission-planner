'use client';

import { useState } from 'react';
import { AlertTriangle, Check, CloudOff, Loader2, Pencil } from 'lucide-react';
import { useSaveStore } from '@/lib/store/save-store';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Header save state: Saving… / Saved / Unsaved changes / Not saved · Retry /
 * Changed elsewhere. Icon + text, never colour alone. */
export function SaveIndicator({ className }: { className?: string }) {
  const { status, error, flush, overwrite } = useSaveStore();
  const [busy, setBusy] = useState(false);

  const reload = () => window.location.reload();

  return (
    <>
      <div className={cn('flex min-w-0 items-center gap-2 text-[13px]', className)} aria-live="polite">
        {status === 'saving' && (
          <span className="flex items-center gap-1.5 text-text-dim">
            <Loader2 size={14} className="animate-spin" aria-hidden /> Saving…
          </span>
        )}
        {status === 'pending' && (
          <span className="flex items-center gap-1.5 text-text-dim">
            <Pencil size={14} aria-hidden /> Unsaved changes
          </span>
        )}
        {status === 'saved' && (
          <span className="flex items-center gap-1.5 text-text-dim">
            <Check size={14} className="text-green" aria-hidden /> Saved
          </span>
        )}
        {status === 'error' && (
          <span className="flex min-w-0 items-center gap-1.5 text-red" title={error ?? undefined}>
            <CloudOff size={14} aria-hidden />
            <span className="whitespace-nowrap">Not saved</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await flush();
                setBusy(false);
              }}
              className="rounded-sm font-medium underline underline-offset-2 hover:text-text focus-visible:outline-2 focus-visible:outline-blue"
            >
              Retry
            </button>
          </span>
        )}
        {status === 'conflict' && (
          <span className="flex items-center gap-1.5 text-amber">
            <AlertTriangle size={14} aria-hidden /> Changed elsewhere
          </span>
        )}
      </div>

      <Dialog open={status === 'conflict'} onClose={() => undefined} size="sm">
        <DialogHeader>
          <DialogTitle className="text-sm">This mission changed elsewhere</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-[13px] leading-relaxed text-text-dim">
            Another tab or device saved a newer version. Reload to see it (your unsaved edits here are discarded), or
            overwrite it with what you see now.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={reload}>
            Reload
          </Button>
          <Button
            variant="primary"
            size="sm"
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
