'use client';

import { Select, SelectItem } from '@/components/heroui';
import { testRunCaseStatus } from '@/config/selection';
import type { RunCaseType } from '@/types/run';
import type { TestRunCaseStatusMessages } from '@/types/status';

type Props = {
  runCase: RunCaseType;
  statusLabel: string;
  statusMessages: TestRunCaseStatusMessages;
  onStatusChange: (runCase: RunCaseType, nextStatus: number) => void;
  isDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showLabel?: boolean;
};

export default function RunCaseStatusSelect({
  runCase,
  statusLabel,
  statusMessages,
  onStatusChange,
  isDisabled = false,
  size = 'sm',
  className,
  showLabel = false,
}: Props) {
  const selectedStatus = testRunCaseStatus[runCase.status];
  const selectedKey = selectedStatus ? selectedStatus.uid : testRunCaseStatus[0].uid;

  return (
    <span className="inline-flex items-center gap-2">
      <Select
        size={size}
        variant="bordered"
        aria-label={`${statusLabel} ${runCase.caseId}`}
        label={showLabel ? statusLabel : undefined}
        labelPlacement="outside-left"
        selectedKeys={[selectedKey]}
        isDisabled={isDisabled}
        className={className ?? 'min-w-32'}
        onSelectionChange={(newSelection) => {
          if (newSelection !== 'all' && newSelection.size !== 0) {
            const selectedUid = Array.from(newSelection)[0];
            const index = testRunCaseStatus.findIndex((status) => status.uid === selectedUid);
            if (index >= 0) {
              onStatusChange(runCase, index);
            }
          }
        }}
      >
        {testRunCaseStatus.map((status) => (
          <SelectItem key={status.uid}>{statusMessages[status.uid] || status.uid}</SelectItem>
        ))}
      </Select>
      {runCase.editState === 'changed' && (
        <span
          aria-label={`${statusLabel} unsaved`}
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-danger"
        />
      )}
    </span>
  );
}
