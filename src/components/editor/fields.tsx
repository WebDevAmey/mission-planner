'use client';

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/base/input/input';
import { Select, SelectItem } from '@/components/base/select/select';
import { cx } from '@/utils/cx';

/**
 * Controlled numeric field: edits stay local until blur / Enter, then commit if
 * valid (TECHNICAL_SPEC §6: controlled inputs with validation messages).
 */
export function NumberField({
  label,
  value,
  onCommit,
  unit,
  min,
  max,

  precision,
  allowEmpty,
  hint,
  mono,
  className,
}: {
  label: string;
  value: number | null | undefined;
  onCommit: (v: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  precision?: number;
  allowEmpty?: boolean;
  hint?: ReactNode;
  /** Literal coordinates render in the mono face; every other number is tabular sans. */
  mono?: boolean;
  className?: string;
}) {
  const shown = value == null || !Number.isFinite(value) ? '' : precision != null ? String(Number(value.toFixed(precision))) : String(value);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? shown;
  const parsed = text.trim() === '' ? null : Number(text);
  const invalid =
    draft !== null &&
    ((parsed === null && !allowEmpty) ||
      (parsed !== null && (!Number.isFinite(parsed) || (min != null && parsed < min) || (max != null && parsed > max))));

  const commit = () => {
    if (draft === null) return;
    if (!invalid && parsed !== value) onCommit(parsed);
    setDraft(null);
  };

  const range =
    min != null && max != null ? `${min}–${max}${unit ? ` ${unit}` : ''}` : min != null ? `≥ ${min}${unit ? ` ${unit}` : ''}` : undefined;

  return (
    <Input
      size="small"
      label={unit ? `${label} (${unit})` : label}
      value={text}
      inputMode="decimal"
      isInvalid={invalid}
      hint={invalid ? `Enter a number${range ? ` (${range})` : ''}` : hint}
      onChange={(v) => setDraft(v)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className={cx('min-w-0', className)}
      fieldClassName={mono ? 'font-mono tabular-nums' : 'tabular-nums'}
    />
  );
}

export function TextInputField({
  label,
  value,
  onCommit,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <Input
      size="small"
      label={label}
      value={draft ?? value}
      placeholder={placeholder}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') setDraft(null);
      }}
      className={className}
    />
  );
}

export function SelectField<K extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: K;
  options: { value: K; label: string }[];
  onChange: (v: K) => void;
  className?: string;
}) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1', className)}>
      <span className="text-[13px] font-medium text-text-primary">{label}</span>
      <Select
        aria-label={label}
        size="sm"
        selectedKey={String(value)}
        onSelectionChange={(k) => {
          const opt = options.find((o) => String(o.value) === String(k));
          if (opt) onChange(opt.value);
        }}
        className="w-full"
        triggerClassName="w-full"
      >
        {options.map((o) => (
          <SelectItem key={String(o.value)} id={String(o.value)} textValue={o.label}>
            {o.label}
          </SelectItem>
        ))}
      </Select>
    </div>
  );
}

export function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex flex-col gap-3', className)}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium text-text-primary">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
