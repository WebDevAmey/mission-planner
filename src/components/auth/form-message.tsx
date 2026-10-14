import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FormMessage({ variant, children }: { variant: 'error' | 'success'; children: React.ReactNode }) {
  const Icon = variant === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      className={cn(
        'mb-4 flex items-start gap-2 rounded-sm border px-3 py-2 font-sans text-[12.5px] leading-relaxed',
        variant === 'error' ? 'border-red/40 bg-red-bg text-red' : 'border-green/40 bg-green-bg text-green'
      )}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
