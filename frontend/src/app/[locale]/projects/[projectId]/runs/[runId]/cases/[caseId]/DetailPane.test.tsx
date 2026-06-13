// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DetailPane from './DetailPane';
import { TokenContext } from '@/utils/TokenProvider';
import type { TokenContextType } from '@/types/user';

const mocks = vi.hoisted(() => ({
  fetchCase: vi.fn(),
  getExecutionRunCase: vi.fn(),
  handleRunCaseStatusChange: vi.fn(),
}));

vi.mock('@/utils/caseControl', () => ({
  fetchCase: mocks.fetchCase,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('tab=execution'),
}));

vi.mock('@/src/i18n/routing', () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
  NextUiLinkClasses: '',
}));

vi.mock('../../RunExecutionContext', () => ({
  useRunExecution: () => ({
    getExecutionRunCase: mocks.getExecutionRunCase,
    handleRunCaseStatusChange: mocks.handleRunCaseStatusChange,
    canEditExecution: true,
  }),
}));

vi.mock('../../RunCaseStatusSelect', () => ({
  default: ({
    runCase,
    statusLabel,
    isDisabled,
  }: {
    runCase: { caseId: number };
    statusLabel: string;
    isDisabled?: boolean;
  }) => (
    <select aria-label={`${statusLabel} ${runCase.caseId}`} disabled={isDisabled}>
      <option value="0">Untested</option>
    </select>
  ),
}));

vi.mock('@/components/TestCasePriority', () => ({ default: () => null }));
vi.mock('@/config/selection', () => ({
  templates: [{ uid: 'text' }, { uid: 'step' }],
  testTypes: [{ uid: 'functional' }],
}));
vi.mock('@/components/Comments', () => ({ default: () => null }));
vi.mock('@/components/History', () => ({ default: () => null }));
vi.mock('@/components/heroui', () => ({
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tab: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

const tokenContext: TokenContextType = {
  token: {
    access_token: 'token',
    expires_at: Date.now() + 1000,
    user: null,
  },
  isSignedIn: () => true,
  isAdmin: () => false,
  isProjectOwner: () => false,
  isProjectManager: () => false,
  isProjectDeveloper: () => false,
  isProjectReporter: () => false,
  refreshProjectRoles: () => {},
  setToken: () => {},
  storeTokenToLocalStorage: () => {},
  removeTokenFromLocalStorage: () => {},
};

const messages = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  type: 'Type',
  tags: 'Tags',
  status: 'Status',
  testDetail: 'Test detail',
  steps: 'Steps',
  preconditions: 'Preconditions',
  expectedResult: 'Expected result',
  detailsOfTheStep: 'Step details',
  caseDetail: 'Case detail',
  comments: 'Comments',
  history: 'History',
};

describe('DetailPane execution status', () => {
  beforeEach(() => {
    mocks.fetchCase.mockResolvedValue({
      id: 20,
      title: 'Checkout card',
      folderId: 1,
      priority: 2,
      type: 0,
      template: 1,
      description: 'desc',
      Steps: [],
      Tags: [],
      RunCases: [{ id: 100, runId: 2, caseId: 20, status: 0 }],
    });
    mocks.getExecutionRunCase.mockReturnValue({
      id: 100,
      runId: 2,
      caseId: 20,
      status: 0,
      editState: 'notChanged',
      createdAt: '',
      updatedAt: '',
    });
  });

  it('renders the execution status select when tab=execution and run case exists', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <DetailPane
            projectId="1"
            runId="2"
            caseId="20"
            locale="en"
            messages={messages}
            testTypeMessages={{ functional: 'Functional' } as never}
            priorityMessages={{ high: 'High' } as never}
            testRunCaseStatusMessages={{ untested: 'Untested' } as never}
            commentMessages={{ comments: 'Comments' } as never}
          />
        </TokenContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('select[aria-label="Status 20"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('does not render the execution status select without a matching run case', async () => {
    mocks.getExecutionRunCase.mockReturnValue(undefined);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <DetailPane
            projectId="1"
            runId="2"
            caseId="20"
            locale="en"
            messages={messages}
            testTypeMessages={{ functional: 'Functional' } as never}
            priorityMessages={{ high: 'High' } as never}
            testRunCaseStatusMessages={{ untested: 'Untested' } as never}
            commentMessages={{ comments: 'Comments' } as never}
          />
        </TokenContext.Provider>
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('select[aria-label="Status 20"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
