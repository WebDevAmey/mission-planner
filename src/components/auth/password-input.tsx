'use client';

import { useState, type ReactNode } from 'react';
import { Checkbox } from '@/components/base/checkbox/checkbox';
import { Input, type InputProps } from '@/components/base/input/input';

/**
 * BoardUI Input for passwords, with a "Show password" checkbox under the field.
 * `aside` renders on the same row as the checkbox (e.g. "Forgot password?").
 */
export function PasswordInput({
  aside,
  ...props
}: Omit<InputProps, 'type'> & { aside?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-2.5">
      <Input {...props} type={visible ? 'text' : 'password'} />
      <div className="flex items-center justify-between gap-3">
        <Checkbox size="sm" isSelected={visible} onChange={setVisible}>
          Show password
        </Checkbox>
        {aside}
      </div>
    </div>
  );
}
