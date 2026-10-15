'use client';

import { Kbd } from '@/components/base/kbd/kbd';
import { Dialog, DialogBody, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUIStore } from '@/lib/store/ui-store';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';

export function ShortcutsDialog() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);
  const close = () => setOpen(false);
  return (
    <Dialog open={open} onClose={close} size="sm">
      <DialogHeader onClose={close}>
        <DialogTitle className="text-body-semibold">Keyboard shortcuts</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <dl className="flex flex-col">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex min-h-8 items-center justify-between gap-4 border-b border-separator-border last:border-b-0">
              <dt className="text-body-2-regular text-text-secondary">{s.label}</dt>
              <dd className="flex gap-1">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </DialogBody>
    </Dialog>
  );
}
