// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RunEditor from './RunEditor';
import { TokenContext } from '@/utils/TokenProvider';
import type { TokenContextType } from '@/types/user';

const mocks = vi.hoisted(() => ({
  fetchRun: vi.fn(),
  updateRun: vi.fn(),
  updateRunCases: vi.fn(),
  fetchProjectCases: vi.fn(),
  fetchFolders: vi.fn(),
  includeExcludeTestCases: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }));

vi.mock('../runsControl', () => ({
  fetchRun: mocks.fetchRun,
  updateRun: mocks.updateRun,
  updateRunCases: mocks.updateRunCases,
  fetchProjectCases: mocks.fetchProjectCases,
  includeExcludeTestCases: mocks.includeExcludeTestCases,
  changeStatus: vi.fn(),
  exportRun: vi.fn(),
}));

vi.mock('../../folders/foldersControl', () => ({
  fetchFolders: mocks.fetchFolders,
}));

vi.mock('@/utils/formGuard', () => ({ useFormGuard: vi.fn() }));
vi.mock('@/src/i18n/routing', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('./RunPregressDonutChart', () => ({ default: () => null }));
vi.mock('./TestRunFilter', () => ({
  default: ({ onFilterChange }: { onFilterChange: (search: string, status: number[], tag: number[]) => void }) => (
    <button type="button" onClick={() => onFilterChange('login', [], [])}>
      apply filter
    </button>
  ),
}));
vi.mock('./TestCaseSelector', () => ({
  default: ({
    cases,
    onIncludeCase,
    onSelectionChange,
  }: {
    cases: Array<{ id: number; title: string }>;
    onIncludeCase: (id: number) => void;
    onSelectionChange: (selection: Set<number>) => void;
  }) => (
    <div>
      {cases.map((testCase) => (
        <div key={testCase.id}>
          <button type="button" onClick={() => onIncludeCase(testCase.id)}>
            include {testCase.id}
          </button>
          <button type="button" onClick={() => onSelectionChange(new Set([testCase.id]))}>
            select {testCase.id}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('react-arborist', () => ({
  Tree: ({ data, children }: { data: Array<Record<string, unknown>>; children: (props: unknown) => React.ReactNode }) => (
    <div data-testid="run-folder-tree">
      {data.map((nodeData) =>
        children({
          node: {
            id: nodeData.id,
            data: nodeData,
            isOpen: false,
            toggle: vi.fn(),
          },
          style: {},
        })
      )}
    </div>
  ),
}));

vi.mock('@/components/TreeItem', () => ({
  default: ({ label, onClick, actions }: { label: string; onClick: () => void; actions?: React.ReactNode }) => (
    <button type="button" onClick={onClick}>
      {label}
      {actions}
    </button>
  ),
}));

vi.mock('@/components/heroui', () => ({
  addToast: vi.fn(),
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Checkbox: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
  Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: () => <input />,
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: ({ children }: { children: React.ReactNode }) => <select>{children}</select>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <option>{children}</option>,
  Separator: () => <hr />,
  TextArea: () => <textarea />,
  Tooltip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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
  isProjectDeveloper: () => true,
  isProjectReporter: () => true,
  refreshProjectRoles: () => {},
  setToken: () => {},
  storeTokenToLocalStorage: () => {},
  removeTokenFromLocalStorage: () => {},
};

const messages = {
  areYouSureLeave: 'Are you sure?',
  backToRuns: 'Back',
  progress: 'Progress',
  refresh: 'Refresh',
  title: 'Title',
  pleaseEnter: 'Please enter',
  description: 'Description',
  status: 'Status',
  filter: 'Filter',
  export: 'Export',
  update: 'Update',
  updating: 'Updating',
  updatedTestRun: 'Updated',
  selectTestCase: 'Select Test Case',
  includeSubfolders: 'Include subfolders',
  testCaseSelection: 'Selection',
  includeInRun: 'Include',
  excludeFromRun: 'Exclude',
  pleaseSave: 'Please save',
} as never;

describe('RunEditor', () => {
  beforeEach(() => {
    mocks.fetchRun.mockResolvedValue({
      run: { id: 2, name: 'Regression', configurations: 0, description: '', state: 0, projectId: 1 },
      statusCounts: [],
    });
    mocks.fetchFolders.mockResolvedValue([
      {
        id: 4,
        name: 'Login',
        detail: '',
        projectId: 1,
        parentFolderId: null,
        createdAt: '',
        updatedAt: '',
        Cases: [],
      },
      {
        id: 5,
        name: 'Checkout',
        detail: '',
        projectId: 1,
        parentFolderId: null,
        createdAt: '',
        updatedAt: '',
        Cases: [],
      },
    ]);
    mocks.fetchProjectCases.mockResolvedValue([]);
    mocks.includeExcludeTestCases.mockImplementation((isInclude: boolean, keys: number[], runId: number, cases: never[]) =>
      cases.map((testCase: { id: number }) =>
        keys.includes(testCase.id)
          ? { ...testCase, RunCases: [{ id: -1, runId, status: 0, editState: isInclude ? 'new' : 'deleted' }] }
          : testCase
      )
    );
    mocks.updateRun.mockResolvedValue({});
    mocks.updateRunCases.mockResolvedValue([]);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('fetches Test Run case selection from the initial Folder Scope', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunEditor
            projectId="1"
            runId="2"
            messages={messages}
            runStatusMessages={{ new: 'New', inProgress: 'In Progress', completed: 'Completed' } as never}
            testRunCaseStatusMessages={{ untested: 'Untested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked' } as never}
            priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
            testTypeMessages={{ functional: 'Functional' } as never}
            locale="en"
          />
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenCalledWith('token', 1, 2, 4, true, undefined, undefined, undefined);

    await act(async () => {
      root.unmount();
    });
  });

  it('preserves dirty Test Run case edits while switching Folder Scopes before saving', async () => {
    mocks.fetchProjectCases
      .mockResolvedValueOnce([
        {
          id: 10,
          title: 'Mobile login',
          folderId: 4,
          state: 0,
          priority: 1,
          type: 4,
          automationStatus: 1,
          description: '',
          template: 1,
          preConditions: '',
          expectedResults: '',
          folderPath: ['Login'],
          RunCases: [],
        },
      ])
      .mockResolvedValueOnce([]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunEditor
            projectId="1"
            runId="2"
            messages={messages}
            runStatusMessages={{ new: 'New', inProgress: 'In Progress', completed: 'Completed' } as never}
            testRunCaseStatusMessages={{ untested: 'Untested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked' } as never}
            priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
            testTypeMessages={{ functional: 'Functional' } as never}
            locale="en"
          />
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'include 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Checkout') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Update') as HTMLButtonElement)
        .click();
    });

    expect(mocks.updateRunCases).toHaveBeenCalledWith(
      'token',
      2,
      [expect.objectContaining({ id: 10, RunCases: [expect.objectContaining({ editState: 'new' })] })]
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('clears selected Test Cases when filters reload the current Folder Scope', async () => {
    mocks.fetchProjectCases
      .mockResolvedValueOnce([
        {
          id: 10,
          title: 'Mobile login',
          folderId: 4,
          state: 0,
          priority: 1,
          type: 4,
          automationStatus: 1,
          description: '',
          template: 1,
          preConditions: '',
          expectedResults: '',
          folderPath: ['Login'],
          RunCases: [],
        },
      ])
      .mockResolvedValueOnce([]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunEditor
            projectId="1"
            runId="2"
            messages={messages}
            runStatusMessages={{ new: 'New', inProgress: 'In Progress', completed: 'Completed' } as never}
            testRunCaseStatusMessages={{ untested: 'Untested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked' } as never}
            priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
            testTypeMessages={{ functional: 'Functional' } as never}
            locale="en"
          />
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });

    expect(container.textContent).toContain('Selection');

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'apply filter') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).not.toContain('Selection');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows Folder Scope Count in the Test Run folder tree', async () => {
    mocks.fetchFolders.mockResolvedValue([
      {
        id: 4,
        name: 'Login',
        detail: '',
        projectId: 1,
        parentFolderId: null,
        createdAt: '',
        updatedAt: '',
        Cases: [],
        caseCount: 3,
        directCaseCount: 1,
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunEditor
            projectId="1"
            runId="2"
            messages={messages}
            runStatusMessages={{ new: 'New', inProgress: 'In Progress', completed: 'Completed' } as never}
            testRunCaseStatusMessages={{ untested: 'Untested', passed: 'Passed', failed: 'Failed', blocked: 'Blocked' } as never}
            priorityMessages={{ critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }}
            testTypeMessages={{ functional: 'Functional' } as never}
            locale="en"
          />
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const countBadge = container.querySelector('[aria-label="Folder Scope Count 3"]');
    expect(countBadge).not.toBeNull();
    expect(countBadge?.getAttribute('title')).toBe('1 directly placed');

    await act(async () => {
      root.unmount();
    });
  });
});
