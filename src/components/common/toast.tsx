'use client';

import { Notification, NotificationViewport, type NotificationStatus } from '@/components/base/notification/notification';
import { useUIStore, type Toast } from '@/lib/store/ui-store';

const STATUS: Record<Toast['type'], NotificationStatus> = {
  success: 'success',
  error: 'error',
  warning: 'neutral',
  info: 'information',
};

/** App-wide toasts (editor + dashboard), rendered with BoardUI notifications. */
export function ToastContainer({ position = 'bottom-end' }: { position?: 'bottom-end' | 'top-end' | 'bottom-start' }) {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);

  return (
    <NotificationViewport position={position} className="z-[2000]">
      {toasts.map((t) => (
        <Notification
          key={t.id}
          status={STATUS[t.type]}
          title={t.message}
          onDismiss={() => removeToast(t.id)}
          actions={t.action ? [{ label: t.action.label, onClick: () => { t.action?.onClick(); removeToast(t.id); }, variant: 'secondary' }] : undefined}
        />
      ))}
    </NotificationViewport>
  );
}
