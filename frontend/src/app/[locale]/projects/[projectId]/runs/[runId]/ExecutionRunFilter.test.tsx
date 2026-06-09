import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import ExecutionRunFilter from './ExecutionRunFilter';

vi.mock('@/utils/tagsControls', () => ({
  fetchTags: vi.fn(),
}));

vi.mock('@/components/heroui', () => ({
  addToast: vi.fn(),
  Button: ({ children }: { children: React.ReactNode }) => <button type="button">{children}</button>,
  Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: ({ value }: { value?: string }) => <input value={value || ''} readOnly />,
}));

const messages = {
  caseTitleOrDescription: 'Case title or description',
  status: 'Status',
  selectStatus: 'Select status',
  membership: 'Membership',
  selected: 'Selected',
  selectTags: 'Select tags',
  tags: 'Tags',
  priority: 'Priority',
  type: 'Type',
  selectPriorities: 'Select priorities',
  selectTypes: 'Select types',
  clearAll: 'Clear all',
  apply: 'Apply',
} as never;

describe('ExecutionRunFilter', () => {
  it('filters Run Case Execution by Run Case Status instead of Membership', () => {
    const markup = renderToStaticMarkup(
      <ExecutionRunFilter
        messages={messages}
        projectId="1"
        activeSearchFilter=""
        activeStatusFilters={[]}
        activeTagFilters={[]}
        activePriorityFilters={[]}
        activeTypeFilters={[]}
        onFilterChange={() => {}}
        priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
        testRunCaseStatusMessages={{ untested: 'Untested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked' } as never}
        testTypeMessages={{ functional: 'Functional', security: 'Security' } as never}
      />
    );

    expect(markup).toContain('Status');
    expect(markup).toContain('Select status');
    expect(markup).toContain('Untested');
    expect(markup).toContain('Passed');
    expect(markup).toContain('Failed');
    expect(markup).not.toContain('Membership');
  });
});
