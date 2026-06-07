// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TestCaseTable from './TestCaseTable';
import type { CasesMessages, CaseType } from '@/types/case';

vi.mock('@/src/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  NextUiLinkClasses: '',
}));

const messages: CasesMessages = {
  testCaseList: 'Test Case List',
  id: 'ID',
  title: 'Title',
  folderPath: 'Folder Path',
  includeSubfolders: 'Include subfolders',
  folderScope: 'Includes subfolders',
  directlyPlacedOnly: 'Current folder only',
  directPlacementEmpty: 'No directly placed test cases',
  priority: 'Priority',
  actions: 'Actions',
  deleteCase: 'Delete test case',
  close: 'Close',
  areYouSure: 'Are you sure?',
  delete: 'Delete',
  newTestCase: 'New',
  export: 'Export',
  status: 'Status',
  noCasesFound: 'No test cases found',
  caseTitle: 'Test Case Title',
  caseDescription: 'Test Case Description',
  caseTitleOrDescription: 'Test case title or description',
  create: 'Create',
  pleaseEnter: 'Please enter',
  filter: 'Filter',
  clearAll: 'Clear all',
  apply: 'Apply',
  selectPriorities: 'Select priorities',
  selected: 'Selected',
  type: 'Type',
  selectTypes: 'Select types',
  casesSelected: 'cases selected',
  selectAction: 'Select action',
  move: 'Move',
  clone: 'Clone',
  casesMoved: 'Test cases moved',
  tags: 'Tags',
  casesCloned: 'Test cases cloned',
  selectTags: 'Select tags',
  import: 'Import',
  importCases: 'Import Test Cases',
  importAvailable: 'Import available',
  downloadTemplate: 'Download Template',
  clickToUpload: 'Click to upload',
  orDragAndDrop: ' or drag and drop',
  maxFileSize: 'Max. file size',
  casesImported: 'Test cases imported',
  createMore: 'Create more',
};

const caseRow: CaseType = {
  id: 1,
  title: 'Mobile login',
  state: 0,
  priority: 1,
  type: 4,
  automationStatus: 1,
  description: '',
  template: 1,
  preConditions: '',
  expectedResults: '',
  folderId: 2,
  folderPath: ['Login', 'Mobile'],
  Tags: [],
};

describe('TestCaseTable', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('shows Folder Path for Test Cases in a Folder Scope list', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestCaseTable
          projectId="1"
          isDisabled={false}
          cases={[caseRow]}
          onCreateCase={vi.fn()}
          onDeleteCase={vi.fn()}
          onDeleteCases={vi.fn()}
          onShowImportDialog={vi.fn()}
          onExportCases={vi.fn()}
          onFilterChange={vi.fn()}
          onIncludeSubfoldersChange={vi.fn()}
          includeSubfolders={true}
          activeSearchFilter=""
          activePriorityFilters={[]}
          activeTypeFilters={[]}
          activeTagFilters={[]}
          messages={messages}
          priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
          testTypeMessages={{
            other: 'Other',
            security: 'Security',
            performance: 'Performance',
            accessibility: 'Accessibility',
            functional: 'Functional',
            acceptance: 'Acceptance',
            usability: 'Usability',
            smoke_sanity: 'Smoke&Sanity',
            compatibility: 'Compatibility',
            destructive: 'Destructive',
            regression: 'Regression',
            automated: 'Automated',
            manual: 'Manual',
          }}
          locale="en"
        />
      );
    });

    expect(container.textContent).toContain('Folder Path');
    expect(container.textContent).toContain('Login / Mobile');

    await act(async () => {
      root.unmount();
    });
  });

  it('drops selections that are no longer visible before bulk delete', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onDeleteCases = vi.fn();
    const secondCase = { ...caseRow, id: 2, title: 'Desktop login', folderPath: ['Login', 'Desktop'] };

    const renderTable = (cases: CaseType[]) =>
      root.render(
        <TestCaseTable
          projectId="1"
          isDisabled={false}
          cases={cases}
          onCreateCase={vi.fn()}
          onDeleteCase={vi.fn()}
          onDeleteCases={onDeleteCases}
          onShowImportDialog={vi.fn()}
          onExportCases={vi.fn()}
          onFilterChange={vi.fn()}
          onIncludeSubfoldersChange={vi.fn()}
          includeSubfolders={true}
          activeSearchFilter=""
          activePriorityFilters={[]}
          activeTypeFilters={[]}
          activeTagFilters={[]}
          messages={messages}
          priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
          testTypeMessages={{
            other: 'Other',
            security: 'Security',
            performance: 'Performance',
            accessibility: 'Accessibility',
            functional: 'Functional',
            acceptance: 'Acceptance',
            usability: 'Usability',
            smoke_sanity: 'Smoke&Sanity',
            compatibility: 'Compatibility',
            destructive: 'Destructive',
            regression: 'Regression',
            automated: 'Automated',
            manual: 'Manual',
          }}
          locale="en"
        />
      );

    await act(async () => {
      renderTable([caseRow, secondCase]);
    });

    const selectAll = container.querySelector('thead input[type="checkbox"]') as HTMLInputElement;
    await act(async () => {
      selectAll.click();
    });

    await act(async () => {
      renderTable([caseRow]);
    });

    const deleteButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(messages.delete)
    ) as HTMLButtonElement;
    await act(async () => {
      deleteButton.click();
    });

    expect(onDeleteCases).toHaveBeenCalledWith([caseRow.id]);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows direct-only scope and empty state when Include Subfolders is off', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TestCaseTable
          projectId="1"
          isDisabled={false}
          cases={[]}
          onCreateCase={vi.fn()}
          onDeleteCase={vi.fn()}
          onDeleteCases={vi.fn()}
          onShowImportDialog={vi.fn()}
          onExportCases={vi.fn()}
          onFilterChange={vi.fn()}
          onIncludeSubfoldersChange={vi.fn()}
          includeSubfolders={false}
          activeSearchFilter=""
          activePriorityFilters={[]}
          activeTypeFilters={[]}
          activeTagFilters={[]}
          messages={messages}
          priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
          testTypeMessages={{
            other: 'Other',
            security: 'Security',
            performance: 'Performance',
            accessibility: 'Accessibility',
            functional: 'Functional',
            acceptance: 'Acceptance',
            usability: 'Usability',
            smoke_sanity: 'Smoke&Sanity',
            compatibility: 'Compatibility',
            destructive: 'Destructive',
            regression: 'Regression',
            automated: 'Automated',
            manual: 'Manual',
          }}
          locale="en"
        />
      );
    });

    expect(container.textContent).toContain('Current folder only');
    expect(container.textContent).toContain('No directly placed test cases');
    expect(container.textContent).not.toContain('No test cases found');

    await act(async () => {
      root.unmount();
    });
  });
});
