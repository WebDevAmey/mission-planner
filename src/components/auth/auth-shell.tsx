import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-[380px]">
        <div className="rounded-lg border border-border-mid bg-bg-panel p-7 shadow-[0_24px_60px_rgba(0,0,0,0.5)] sm:p-8">
          <div className="mb-5 flex items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground">
              <Lock size={14} className="text-background" />
            </div>
            <span className="font-sans text-[15px] font-bold text-text">Flight Deck</span>
          </div>
          <h1 className="mb-1 font-sans text-lg font-bold text-text">{title}</h1>
          {subtitle && <p className="mb-6 font-sans text-[13px] leading-relaxed text-text-dim">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="mt-5 text-center font-sans text-[13px] text-text-dim">{footer}</div>}
      </div>
    </div>
  );
}
