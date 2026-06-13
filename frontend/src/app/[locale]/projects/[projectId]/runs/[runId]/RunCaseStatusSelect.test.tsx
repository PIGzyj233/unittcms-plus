// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import RunCaseStatusSelect from './RunCaseStatusSelect';
import type { RunCaseType } from '@/types/run';

vi.mock('@/components/heroui', () => ({
  Select: ({
    'aria-label': ariaLabel,
    selectedKeys,
    onSelectionChange,
    isDisabled,
  }: {
    'aria-label'?: string;
    selectedKeys?: string[];
    onSelectionChange?: (keys: Set<string>) => void;
    isDisabled?: boolean;
  }) => (
    <select
      aria-label={ariaLabel}
      disabled={isDisabled}
      value={selectedKeys?.[0] || ''}
      onChange={(event) => onSelectionChange?.(new Set([event.target.value]))}
    >
      <option value="untested">Untested</option>
      <option value="passed">Passed</option>
      <option value="failed">Failed</option>
      <option value="retest">Retest</option>
      <option value="skipped">Skipped</option>
    </select>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const runCase: RunCaseType = {
  id: 100,
  runId: 2,
  caseId: 20,
  status: 0,
  editState: 'notChanged',
  createdAt: '',
  updatedAt: '',
};

const statusMessages = {
  untested: 'Untested',
  passed: 'Passed',
  failed: 'Failed',
  retest: 'Retest',
  skipped: 'Skipped',
};

describe('RunCaseStatusSelect', () => {
  it('renders a select with the current status and dirty indicator when changed', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RunCaseStatusSelect
          runCase={{ ...runCase, editState: 'changed' }}
          statusLabel="Status"
          statusMessages={statusMessages}
          onStatusChange={vi.fn()}
        />
      );
    });

    const select = container.querySelector('select[aria-label="Status 20"]') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('untested');
    expect(container.querySelector('[aria-label="Status unsaved"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('calls onStatusChange with the selected status index', async () => {
    const onStatusChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <RunCaseStatusSelect
          runCase={runCase}
          statusLabel="Status"
          statusMessages={statusMessages}
          onStatusChange={onStatusChange}
        />
      );
    });

    const select = container.querySelector('select[aria-label="Status 20"]') as HTMLSelectElement;
    await act(async () => {
      select.value = 'failed';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onStatusChange).toHaveBeenCalledWith(runCase, 2);

    await act(async () => {
      root.unmount();
    });
  });
});
