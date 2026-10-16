'use client';

import { useState } from 'react';
import { RiArrowDownSLine, RiDownload2Line, RiErrorWarningLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { buttonStyles } from '@/components/base/buttons/button';
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { analyseMission } from '@/hooks/useMissionAnalysis';
import type { Issue } from '@/lib/domain/validate';
import { cx } from '@/utils/cx';
import { MENU_PANEL } from '../editor-styles';
import { EXPORT_FORMATS, buildExport, downloadText, type ExportFormatInfo } from './exporters';

export function ExportFormatList({ onPick }: { onPick: (f: ExportFormatInfo) => void }) {
  return (
    <>
      {EXPORT_FORMATS.map((f, i) => (
        <div key={f.id}>
          {i === 5 && <DropdownDivider />}
          <DropdownItem onSelect={() => onPick(f)} className="flex-col items-start gap-0 px-2 py-1.5">
            <span className="text-[14px] text-text-primary">
              {f.label} <span className="font-mono text-[12px] text-text-tertiary">.{f.ext}</span>
            </span>
            <span className="text-[12px] text-text-secondary">{f.description}</span>
          </DropdownItem>
        </div>
      ))}
    </>
  );
}

/** Confirmation shown when exporting a mission that has validation errors. */
export function ExportAnywayDialog({
  open,
  issues,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  issues: Issue[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const errors = issues.filter((i) => i.severity === 'error');
  return (
    <Dialog open={open} onClose={onCancel} size="sm">
      <DialogHeader onClose={onCancel}>
        <DialogTitle className="flex items-center gap-2 text-[16px] font-medium">
          <RiErrorWarningLine className="size-4 text-fd-danger" aria-hidden />
          This mission has {errors.length} error{errors.length === 1 ? '' : 's'}
        </DialogTitle>
      </DialogHeader>
      <DialogBody>
        <ul className="flex flex-col gap-1.5">
          {errors.slice(0, 4).map((e, i) => (
            <li key={i} className="text-[14px] text-text-secondary">
              {e.message}
            </li>
          ))}
        </ul>
        {errors.length > 4 && <p className="mt-2 text-[12px] text-text-tertiary">+{errors.length - 4} more in Checks</p>}
        <p className="mt-3 text-[14px] text-text-secondary">A vehicle may reject or mis-fly this file.</p>
      </DialogBody>
      <DialogFooter>
        <Button size="small" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="small" variant="danger" onClick={onConfirm}>
          Export anyway
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/** Editor header Export menu: builds files client-side from the open mission. */
export function EditorExportMenu({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ format: ExportFormatInfo; issues: Issue[] } | null>(null);
  const addToast = useUIStore((s) => s.addToast);

  const run = (f: ExportFormatInfo) => {
    const mission = useMissionStore.getState().mission;
    if (!mission) return;
    try {
      const file = buildExport(f.id, mission);
      downloadText(file.content, file.filename, file.mimeType);
      addToast(`Downloaded ${file.filename}`, 'success');
    } catch (err) {
      addToast(`Export failed: ${err instanceof Error ? err.message : 'unknown error'}`, 'error');
    }
  };

  const pick = (f: ExportFormatInfo) => {
    setOpen(false);
    const mission = useMissionStore.getState().mission;
    if (!mission) return;
    if (mission.items.length === 0) {
      addToast('Add at least one waypoint before exporting', 'error');
      return;
    }
    const { issues, errors } = analyseMission(mission);
    if (errors > 0) setPending({ format: f, issues });
    else run(f);
  };

  return (
    <>
      <Dropdown isOpen={open} onOpenChange={setOpen}>
        <DropdownTrigger
          aria-label="Export mission"
          className={cx(buttonStyles.base, buttonStyles.size.small, buttonStyles.variant.primary, 'gap-1')}
        >
          <RiDownload2Line className={cx('size-4', !compact && 'max-sm:hidden')} aria-hidden />
          {!compact && <span className="px-0.5">Export</span>}
          <RiArrowDownSLine className="size-4 max-sm:hidden" aria-hidden />
        </DropdownTrigger>
        <DropdownPopover aria-label="Export formats" placement="bottom end" className={cx('w-[300px]', MENU_PANEL)}>
          <ExportFormatList onPick={pick} />
        </DropdownPopover>
      </Dropdown>
      <ExportAnywayDialog
        open={!!pending}
        issues={pending?.issues ?? []}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) run(pending.format);
          setPending(null);
        }}
      />
    </>
  );
}
