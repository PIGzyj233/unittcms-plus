import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import TestRunFilter from './TestRunFilter';

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
  membership: 'Membership',
  all: 'All',
  included: 'Included',
  notIncluded: 'Not included',
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

describe('TestRunFilter', () => {
  it('filters Test Run Case Selection by Membership instead of Run Case Status', () => {
    const markup = renderToStaticMarkup(
      <TestRunFilter
        messages={messages}
        projectId="1"
        activeSearchFilter=""
        activeMembershipFilter="all"
        activeTagFilters={[]}
        activePriorityFilters={[]}
        activeTypeFilters={[]}
        onFilterChange={() => {}}
        priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
        testTypeMessages={{ functional: 'Functional', security: 'Security' } as never}
      />
    );

    expect(markup).toContain('Membership');
    expect(markup).toContain('All');
    expect(markup).toContain('Included');
    expect(markup).toContain('Not included');
    expect(markup).not.toContain('Status');
    expect(markup).not.toContain('Untested');
    expect(markup).not.toContain('Passed');
    expect(markup).not.toContain('Failed');
  });

  it('offers Test Case priority and type filters for Test Run Case Selection', () => {
    const markup = renderToStaticMarkup(
      <TestRunFilter
        messages={messages}
        projectId="1"
        activeSearchFilter=""
        activeMembershipFilter="all"
        activeTagFilters={[]}
        activePriorityFilters={[]}
        activeTypeFilters={[]}
        onFilterChange={() => {}}
        priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
        testTypeMessages={{ functional: 'Functional', security: 'Security' } as never}
      />
    );

    expect(markup).toContain('Priority');
    expect(markup).toContain('Select priorities');
    expect(markup).toContain('Critical');
    expect(markup).toContain('High');
    expect(markup).toContain('Type');
    expect(markup).toContain('Select types');
    expect(markup).toContain('Functional');
    expect(markup).toContain('Security');
  });
});
