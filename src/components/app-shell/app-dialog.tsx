'use client';

import type { ReactNode } from 'react';
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { RiCloseLine } from '@remixicon/react';
import { cx } from '@/utils/cx';

const WIDTH = { sm: 'max-w-[400px]', md: 'max-w-[480px]' } as const;

export interface AppDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** One sentence under the title. */
  description?: ReactNode;
  size?: keyof typeof WIDTH;
  /** Danger dialogs get a danger hairline at the top. */
  tone?: 'default' | 'danger';
  /** Blocks Escape and outside-click while an action is running. */
  busy?: boolean;
  children?: ReactNode;
  footer?: ReactNode;
  /** Wrap body + footer in a form so Enter submits. */
  onSubmit?: () => void;
}

/** App dialog: 10px radius, hairline, float shadow; focus is trapped and restored by react-aria. */
export function AppDialog({ open, onClose, title, description, size = 'sm', tone = 'default', busy, children, footer, onSubmit }: AppDialogProps) {
  const inner = (
    <>
      {children && <div className="flex flex-col gap-4 px-5 pb-5">{children}</div>}
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-separator-border px-5 py-3.5 sm:flex-row sm:items-center sm:justify-end">
          {footer}
        </div>
      )}
    </>
  );
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      className={({ isEntering }) =>
        cx(
          'fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-4 sm:items-center',
          isEntering && 'motion-safe:animate-[fadeIn_200ms_ease-out]'
        )
      }
    >
      <Modal
        className={cx(
          'w-full overflow-hidden rounded-fd-overlay border bg-background-primary-default text-text-primary shadow-fd-float outline-none',
          tone === 'danger' ? 'border-fd-danger/40' : 'border-separator-border',
          WIDTH[size]
        )}
      >
        <Dialog className="max-h-[85dvh] overflow-y-auto outline-none">
          {({ close }) => (
            <>
              <div className="flex items-start gap-3 px-5 pt-5 pb-4">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Heading slot="title" className="text-title-3-medium text-text-primary text-balance">
                    {title}
                  </Heading>
                  {description && <p className="text-body-2-regular text-text-secondary text-pretty">{description}</p>}
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  disabled={busy}
                  onClick={close}
                  className="-me-1.5 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-fd-control text-foreground-icon-secondary outline-none transition-colors duration-150 hover:bg-background-secondary-default hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-50"
                >
                  <RiCloseLine className="size-[18px]" aria-hidden />
                </button>
              </div>
              {onSubmit ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit();
                  }}
                >
                  {inner}
                </form>
              ) : (
                inner
              )}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
