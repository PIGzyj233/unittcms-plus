import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TestCaseSelector from './TestCaseSelector';
import type { CaseType } from '@/types/case';

const messages = {
  id: 'ID',
  title: 'Title',
  folderPath: 'Folder Path',
  priority: 'Priority',
  tags: 'Tags',
  status: 'Status',
  comments: 'Comments',
  actions: 'Actions',
  membership: 'Membership',
  included: 'Included',
  notIncluded: 'Not included',
  pendingInclude: 'Pending include',
  pendingExclude: 'Pending exclude',
  includeInRun: 'Include',
  excludeFromRun: 'Exclude',
  noCasesFound: 'No cases found',
} as never;

const baseCase = {
  state: 0,
  priority: 1,
  type: 4,
  automationStatus: 1,
  description: '',
  template: 1,
  preConditions: '',
  expectedResults: '',
  folderId: 4,
  folderPath: ['Login'],
  Tags: [],
} satisfies Partial<CaseType>;

function testCase(overrides: Partial<CaseType>): CaseType {
  return {
    ...baseCase,
    id: overrides.id || 1,
    title: overrides.title || 'Login case',
    ...overrides,
  } as CaseType;
}

describe('TestCaseSelector', () => {
  it('shows visible row checkboxes for temporary Test Run Case Selection', () => {
    const markup = renderToStaticMarkup(
      <TestCaseSelector
        cases={[testCase({ id: 1, title: 'Selectable case', RunCases: [] })]}
        selectedKeys={new Set([])}
        onSelectionChange={() => {}}
        messages={messages}
        priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
      />
    );

    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain('aria-label="Select row"');
    expect(markup).toContain('Selectable case');
  });

  it('shows Test Run Membership separately from row selection and removes row Membership actions', () => {
    const markup = renderToStaticMarkup(
      <TestCaseSelector
        cases={[
          testCase({ id: 1, title: 'Saved member', RunCases: [{ id: 1, runId: 2, caseId: 1, status: 0, editState: 'notChanged' }] }),
          testCase({ id: 2, title: 'Outside run', RunCases: [] }),
          testCase({ id: 3, title: 'New member', RunCases: [{ id: -1, runId: 2, caseId: 3, status: 0, editState: 'new' }] }),
          testCase({
            id: 4,
            title: 'Removed member',
            RunCases: [{ id: 4, runId: 2, caseId: 4, status: 0, editState: 'deleted' }],
          }),
        ]}
        isDisabled={false}
        selectedKeys={new Set([])}
        onSelectionChange={() => {}}
        messages={messages}
        priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
      />
    );

    expect(markup).toContain('Membership');
    expect(markup).toContain('Included');
    expect(markup).toContain('Not included');
    expect(markup).toContain('Pending include');
    expect(markup).toContain('Pending exclude');
    expect(markup).not.toContain('>Include<');
    expect(markup).not.toContain('>Exclude<');
  });

  it('does not show Run Case Execution controls or Run Case detail links in selection', () => {
    const markup = renderToStaticMarkup(
      <TestCaseSelector
        cases={[
          testCase({
            id: 1,
            title: 'Saved member',
            RunCases: [{ id: 1, runId: 2, caseId: 1, status: 0, editState: 'notChanged', commentCount: 2 }],
          }),
        ]}
        isDisabled={false}
        selectedKeys={new Set([])}
        onSelectionChange={() => {}}
        messages={messages}
        priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
      />
    );

    expect(markup).not.toContain('Status');
    expect(markup).not.toContain('Comments');
    expect(markup).not.toContain('Untested');
    expect(markup).not.toContain('/runs/2/cases/1');
    expect(markup).toContain('Saved member');
  });
});
