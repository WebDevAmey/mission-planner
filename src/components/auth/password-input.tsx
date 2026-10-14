'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        <Input ref={ref} type={visible ? 'text' : 'password'} className={cn('pr-8', className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text"
        >
          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    );
  }
);
