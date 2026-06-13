// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RunEditor from './RunEditor';
import { RunExecutionProvider } from './RunExecutionContext';
import { TokenContext } from '@/utils/TokenProvider';
import type { TokenContextType } from '@/types/user';

const mocks = vi.hoisted(() => ({
  fetchRun: vi.fn(),
  updateRun: vi.fn(),
  updateRunCases: vi.fn(),
  fetchRunCases: vi.fn(),
  fetchProjectCases: vi.fn(),
  fetchFolders: vi.fn(),
  includeExcludeTestCases: vi.fn(),
  useFormGuard: vi.fn(),
  addToast: vi.fn(),
  push: vi.fn(),
  openTreeNodeIds: new Set<string>(),
}));

vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light' }) }));

vi.mock('../runsControl', () => ({
  fetchRun: mocks.fetchRun,
  updateRun: mocks.updateRun,
  updateRunCases: mocks.updateRunCases,
  fetchRunCases: mocks.fetchRunCases,
  fetchProjectCases: mocks.fetchProjectCases,
  includeExcludeTestCases: mocks.includeExcludeTestCases,
  changeStatus: vi.fn(),
  exportRun: vi.fn(),
}));

vi.mock('../../folders/foldersControl', () => ({
  fetchFolders: mocks.fetchFolders,
}));

vi.mock('@/utils/formGuard', () => ({ useFormGuard: mocks.useFormGuard }));
vi.mock('@/src/i18n/routing', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('./RunPregressDonutChart', () => ({ default: () => null }));
vi.mock('./RunCaseStatusSelect', () => ({
  default: ({
    runCase,
    statusLabel,
    onStatusChange,
    isDisabled,
  }: {
    runCase: { caseId: number; status: number; editState?: string };
    statusLabel: string;
    onStatusChange: (runCase: { caseId: number; status: number }, nextStatus: number) => void;
    isDisabled?: boolean;
  }) => (
    <select
      aria-label={`${statusLabel} ${runCase.caseId}`}
      disabled={isDisabled}
      value={String(runCase.status)}
      onChange={(event) => onStatusChange(runCase, Number(event.target.value))}
    >
      <option value="0">Untested</option>
      <option value="1">Passed</option>
      <option value="2">Failed</option>
    </select>
  ),
}));
vi.mock('./TestRunFilter', () => ({
  default: ({
    onFilterChange,
  }: {
    onFilterChange: (
      search: string,
      membership: 'all' | 'included',
      tag: number[],
      priority: number[],
      type: number[]
    ) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onFilterChange('login', 'all', [], [], [])}>
        apply filter
      </button>
      <button type="button" onClick={() => onFilterChange('', 'included', [], [], [])}>
        apply included filter
      </button>
      <button type="button" onClick={() => onFilterChange('', 'all', [3, 5], [], [])}>
        apply tag filter
      </button>
      <button type="button" onClick={() => onFilterChange('', 'all', [], [1, 2], [4])}>
        apply priority type filter
      </button>
    </div>
  ),
}));
vi.mock('./ExecutionRunFilter', () => ({
  default: ({
    onFilterChange,
  }: {
    onFilterChange: (search: string, status: number[], tag: number[], priority: number[], type: number[]) => void;
  }) => (
    <button type="button" onClick={() => onFilterChange('refund', [1], [3], [2], [4])}>
      apply execution filter
    </button>
  ),
}));
vi.mock('./TestCaseSelector', () => ({
  default: ({
    cases,
    onSelectionChange,
  }: {
    cases: Array<{ id: number; title: string }>;
    onSelectionChange: (selection: Set<number>) => void;
  }) => (
    <div>
      <button type="button" onClick={() => onSelectionChange(new Set(cases.map((testCase) => testCase.id)))}>
        select all visible
      </button>
      {cases.map((testCase) => (
        <div key={testCase.id}>
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
            isOpen: mocks.openTreeNodeIds.has(String(nodeData.id)),
            toggle: vi.fn(),
          },
          style: {},
        })
      )}
    </div>
  ),
}));

vi.mock('@/components/TreeItem', () => ({
  default: ({
    label,
    onClick,
    actions,
    icon,
  }: {
    label: string;
    onClick: () => void;
    actions?: React.ReactNode;
    icon?: React.ReactNode;
  }) => (
    <button type="button" onClick={onClick}>
      <span data-testid={`tree-icon-${label}`}>{icon}</span>
      {label}
      {actions}
    </button>
  ),
}));

vi.mock('@/components/heroui', () => ({
  addToast: mocks.addToast,
  Badge: ({
    children,
    content,
    isInvisible,
  }: {
    children: React.ReactNode;
    content?: React.ReactNode;
    isInvisible?: boolean;
  }) => (
    <span>
      {children}
      {content === '' && !isInvisible ? <span data-testid="save-dirty-dot" /> : null}
    </span>
  ),
  Button: ({
    children,
    startContent,
    endContent,
    onPress,
    isDisabled,
    'aria-label': ariaLabel,
  }: {
    children: React.ReactNode;
    startContent?: React.ReactNode;
    endContent?: React.ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    'aria-label'?: string;
  }) => (
    <button type="button" aria-label={ariaLabel} disabled={isDisabled} onClick={onPress}>
      {startContent}
      {children}
      {endContent}
    </button>
  ),
  Checkbox: ({
    children,
    isSelected,
    onValueChange,
  }: {
    children: React.ReactNode;
    isSelected?: boolean;
    onValueChange?: (selected: boolean) => void;
  }) => (
    <label>
      <input
        aria-label={typeof children === 'string' ? children : undefined}
        type="checkbox"
        checked={Boolean(isSelected)}
        onChange={(event) => onValueChange?.(event.target.checked)}
      />
      {children}
    </label>
  ),
  Dropdown: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Input: ({
    label,
    value,
    onChange,
  }: {
    label?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
  }) => <input aria-label={label} value={value || ''} onChange={onChange} onInput={onChange} />,
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Select: ({ children }: { children: React.ReactNode }) => <select>{children}</select>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <option>{children}</option>,
  Separator: () => <hr />,
  Tab: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tabs: ({
    children,
    selectedKey,
    onSelectionChange,
  }: {
    children: React.ReactNode;
    selectedKey?: string;
    onSelectionChange?: (key: string) => void;
  }) => (
    <div>
      {Array.isArray(children)
        ? children.map((child) => {
            if (!child || typeof child !== 'object' || !('props' in child)) return null;
            const tab = child as {
              key?: string;
              props: { id?: string; title?: React.ReactNode; children?: React.ReactNode };
            };
            const key = tab.props.id || tab.key || '';
            const isSelected = selectedKey === key;
            return (
              <div key={key}>
                <button type="button" aria-pressed={isSelected} onClick={() => onSelectionChange?.(key)}>
                  {tab.props.title}
                </button>
                {isSelected ? tab.props.children : null}
              </div>
            );
          })
        : children}
    </div>
  ),
  TextArea: ({
    label,
    value,
    onValueChange,
  }: {
    label?: string;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => <textarea aria-label={label} value={value || ''} onChange={(event) => onValueChange?.(event.target.value)} />,
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
  priority: 'Priority',
  type: 'Type',
  selectPriorities: 'Select priorities',
  selectTypes: 'Select types',
  includeSubfolders: 'Include subfolders',
  testCaseSelection: 'Selection',
  includeInRun: 'Include',
  excludeFromRun: 'Exclude',
  pleaseSave: 'Please save',
  selected: 'Selected',
  testRunOverview: 'Overview',
  runCaseExecution: 'Execution',
  saveOverview: 'Save overview',
  saveSelection: 'Save selection',
  saveExecution: 'Save execution',
  savedRunCasesOnly: 'Execution reflects saved Run Cases only',
  unsavedChanges: 'unsaved changes',
  runCaseSaveConflict: 'Saved Run Cases changed on the server. Reloaded saved state.',
  all: 'All',
  discard: 'Discard',
} as never;

async function openSelectionTab(container: HTMLElement) {
  await act(async () => {
    (
      Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === 'Select Test Case'
      ) as HTMLButtonElement
    ).click();
  });
}

describe('RunEditor', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/projects/1/runs/2');
    mocks.openTreeNodeIds.clear();
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
    mocks.fetchRunCases.mockResolvedValue([]);
    mocks.includeExcludeTestCases.mockImplementation((isInclude: boolean, keys: number[], runId: number, cases: never[]) =>
      cases.map((testCase: { id: number; RunCases?: Array<{ id: number; runId: number; status: number; editState: string }> }) => {
        if (!keys.includes(testCase.id)) {
          return testCase;
        }

        const runCase = testCase.RunCases?.[0];
        if (isInclude) {
          if (!runCase) {
            return { ...testCase, RunCases: [{ id: -1, runId, status: 0, editState: 'new' }] };
          }
          if (runCase.editState === 'deleted') {
            return { ...testCase, RunCases: [{ ...runCase, editState: runCase.id > 0 ? 'notChanged' : 'new' }] };
          }
          return testCase;
        }

        if (!runCase || runCase.editState === 'deleted') {
          return testCase;
        }
        if (runCase.editState === 'new' && runCase.id <= 0) {
          return { ...testCase, RunCases: [] };
        }
        return { ...testCase, RunCases: [{ ...runCase, editState: 'deleted' }] };
      })
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

  it('opens on Test Run Overview before showing Test Run Case Selection', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Overview');
    expect(container.textContent).toContain('Save overview');
    expect(container.textContent).not.toContain('Include subfolders');
    expect(container.querySelector('[data-testid="run-folder-tree"]')).toBeNull();

    await openSelectionTab(container);

    expect(container.querySelector('[data-testid="run-folder-tree"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('restores the active Test Run workflow from URL state and writes tab changes back to the URL', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="run-folder-tree"]')).not.toBeNull();

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });

    expect(new URL(window.location.href).searchParams.get('tab')).toBe('execution');

    await act(async () => {
      root.unmount();
    });
  });

  it('restores Test Run Case Selection Folder Scope and Include Subfolders from URL state', async () => {
    window.history.replaceState(
      {},
      '',
      '/projects/1/runs/2?tab=selection&selectionFolderId=5&selectionIncludeSubfolders=false'
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenCalledWith(
      'token',
      1,
      2,
      5,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('writes selected Test Run Case Selection Folder Scope to URL state', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Checkout') as HTMLButtonElement)
        .click();
    });

    const params = new URL(window.location.href).searchParams;
    expect(params.get('tab')).toBe('selection');
    expect(params.get('selectionFolderId')).toBe('5');

    await act(async () => {
      root.unmount();
    });
  });

  it('writes Test Run Case Selection Include Subfolders changes to URL state', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const includeSubfoldersCheckbox = container.querySelector('input[aria-label="Include subfolders"]') as HTMLInputElement;
    expect(includeSubfoldersCheckbox.checked).toBe(true);

    await act(async () => {
      includeSubfoldersCheckbox.click();
    });

    const params = new URL(window.location.href).searchParams;
    expect(params.get('tab')).toBe('selection');
    expect(params.get('selectionIncludeSubfolders')).toBe('false');
    expect(mocks.fetchProjectCases).toHaveBeenLastCalledWith(
      'token',
      1,
      2,
      4,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('writes Test Run Case Selection search and Membership filters to URL state', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'apply filter') as HTMLButtonElement)
        .click();
    });

    let params = new URL(window.location.href).searchParams;
    expect(params.get('selectionSearch')).toBe('login');

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'apply included filter') as HTMLButtonElement
      ).click();
    });

    params = new URL(window.location.href).searchParams;
    expect(params.get('selectionMembership')).toBe('included');
    expect(params.get('selectionSearch')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('restores Test Run Case Selection search and Membership filters from URL state', async () => {
    window.history.replaceState(
      {},
      '',
      '/projects/1/runs/2?tab=selection&selectionSearch=login&selectionMembership=included'
    );
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Included login',
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
        RunCases: [{ id: 100, runId: 2, caseId: 10, status: 0, editState: 'notChanged' }],
      },
      {
        id: 11,
        title: 'Outside login',
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenCalledWith(
      'token',
      1,
      2,
      4,
      true,
      'login',
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(container.textContent).toContain('select 10');
    expect(container.textContent).not.toContain('select 11');

    await act(async () => {
      root.unmount();
    });
  });

  it('writes Test Run Case Selection tag filters to URL state', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'apply tag filter') as HTMLButtonElement
      ).click();
    });

    const params = new URL(window.location.href).searchParams;
    expect(params.get('selectionTags')).toBe('3,5');

    await act(async () => {
      root.unmount();
    });
  });

  it('restores Test Run Case Selection tag filters from URL state', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection&selectionTags=3,5');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenCalledWith(
      'token',
      1,
      2,
      4,
      true,
      undefined,
      undefined,
      ['3', '5'],
      undefined,
      undefined
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('writes Test Run Case Selection priority and type filters to URL state and candidate query', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent === 'apply priority type filter'
        ) as HTMLButtonElement
      ).click();
    });

    const params = new URL(window.location.href).searchParams;
    expect(params.get('selectionPriorities')).toBe('1,2');
    expect(params.get('selectionTypes')).toBe('4');
    expect(mocks.fetchProjectCases).toHaveBeenLastCalledWith(
      'token',
      1,
      2,
      4,
      true,
      undefined,
      undefined,
      undefined,
      ['1', '2'],
      ['4']
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('restores Test Run Case Selection priority and type filters from URL state', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=selection&selectionPriorities=1,2&selectionTypes=4');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenCalledWith(
      'token',
      1,
      2,
      4,
      true,
      undefined,
      undefined,
      undefined,
      ['1', '2'],
      ['4']
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('restores Run Case Execution filters from independent URL state', async () => {
    window.history.replaceState(
      {},
      '',
      '/projects/1/runs/2?tab=execution&executionSearch=checkout&executionStatus=1,2&executionTags=3,5&executionPriorities=2&executionTypes=4&executionFolderId=5&executionIncludeSubfolders=false&selectionSearch=login'
    );
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchRunCases).toHaveBeenCalledWith('token', 2, {
      search: 'checkout',
      status: ['1', '2'],
      tag: ['3', '5'],
      priority: ['2'],
      type: ['4'],
      folderId: 5,
      includeSubfolders: false,
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('writes Run Case Execution filters to independent URL state and saved Run Case query', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=execution');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent === 'apply execution filter'
        ) as HTMLButtonElement
      ).click();
    });

    const params = new URL(window.location.href).searchParams;
    expect(params.get('tab')).toBe('execution');
    expect(params.get('executionSearch')).toBe('refund');
    expect(params.get('executionStatus')).toBe('1');
    expect(params.get('executionTags')).toBe('3');
    expect(params.get('executionPriorities')).toBe('2');
    expect(params.get('executionTypes')).toBe('4');
    expect(params.get('selectionSearch')).toBeNull();
    expect(mocks.fetchRunCases).toHaveBeenLastCalledWith('token', 2, {
      search: 'refund',
      status: ['1'],
      tag: ['3'],
      priority: ['2'],
      type: ['4'],
    });

    await act(async () => {
      root.unmount();
    });
  });

  it('writes optional Run Case Execution Folder Scope and Include Subfolders to URL state and saved Run Case query', async () => {
    window.history.replaceState({}, '', '/projects/1/runs/2?tab=execution');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Checkout') as HTMLButtonElement)
        .click();
    });

    let params = new URL(window.location.href).searchParams;
    expect(params.get('tab')).toBe('execution');
    expect(params.get('executionFolderId')).toBe('5');
    expect(mocks.fetchRunCases).toHaveBeenLastCalledWith('token', 2, { folderId: 5 });

    const includeSubfoldersCheckbox = container.querySelector('input[aria-label="Include subfolders"]') as HTMLInputElement;
    expect(includeSubfoldersCheckbox.checked).toBe(true);

    await act(async () => {
      includeSubfoldersCheckbox.click();
    });

    params = new URL(window.location.href).searchParams;
    expect(params.get('executionIncludeSubfolders')).toBe('false');
    expect(mocks.fetchRunCases).toHaveBeenLastCalledWith('token', 2, { folderId: 5, includeSubfolders: false });

    await act(async () => {
      root.unmount();
    });
  });

  it('carries Run Case Execution filters into Run Case detail return state', async () => {
    window.history.replaceState(
      {},
      '',
      '/projects/1/runs/2?tab=execution&executionSearch=checkout&executionStatus=1&executionFolderId=5&executionIncludeSubfolders=false'
    );
    mocks.fetchRunCases.mockResolvedValue([
      {
        id: 100,
        runId: 2,
        caseId: 20,
        status: 1,
        editState: 'notChanged',
        commentCount: 0,
        Case: {
          id: 20,
          title: 'Saved executable',
          folderPath: ['Checkout'],
          priority: 1,
          type: 4,
          Tags: [],
        },
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const detailLink = Array.from(container.querySelectorAll('a')).find(
      (anchor) => anchor.textContent === 'Saved executable'
    ) as HTMLAnchorElement;
    const detailUrl = new URL(detailLink.href);
    expect(detailUrl.searchParams.get('tab')).toBe('execution');
    expect(detailUrl.searchParams.get('executionSearch')).toBe('checkout');
    expect(detailUrl.searchParams.get('executionStatus')).toBe('1');
    expect(detailUrl.searchParams.get('executionFolderId')).toBe('5');
    expect(detailUrl.searchParams.get('executionIncludeSubfolders')).toBe('false');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows a conflict notice and reloads saved selection state when saving stale Membership drafts fails', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Pending membership',
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
    ]);
    mocks.updateRunCases.mockRejectedValue(new Error('HTTP error! Status: 409'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'danger',
        description: 'Saved Run Cases changed on the server. Reloaded saved state.',
      })
    );
    expect(mocks.fetchProjectCases).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('shows a conflict notice and reloads saved execution state when saving stale Run Case Status drafts fails', async () => {
    mocks.fetchRunCases.mockResolvedValue([
      {
        id: 100,
        runId: 2,
        caseId: 20,
        status: 0,
        editState: 'notChanged',
        commentCount: 0,
        Case: {
          id: 20,
          title: 'Saved executable',
          folderPath: ['Login'],
          priority: 1,
          type: 4,
          Tags: [],
        },
      },
    ]);
    mocks.updateRunCases.mockRejectedValue(new Error('HTTP error! Status: 409'));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const statusSelect = container.querySelector('select[aria-label="Status 20"]') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = '2';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save execution') as HTMLButtonElement
      ).click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.addToast).toHaveBeenCalledWith(
      expect.objectContaining({
        color: 'danger',
        description: 'Saved Run Cases changed on the server. Reloaded saved state.',
      })
    );
    expect(mocks.fetchRunCases).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('discards unsaved Test Run Overview field changes back to the saved values', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleInput = container.querySelector('input[aria-label="Title"]') as HTMLInputElement;
    expect(titleInput.value).toBe('Regression');

    await act(async () => {
      titleInput.value = 'Changed run';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(titleInput.value).toBe('Changed run');

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Discard') as HTMLButtonElement)
        .click();
    });

    expect((container.querySelector('input[aria-label="Title"]') as HTMLInputElement).value).toBe('Regression');

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps unsaved indicators scoped to the active Test Run workflow save action', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="save-dirty-dot"]')).toBeNull();

    const titleInput = container.querySelector('input[aria-label="Title"]') as HTMLInputElement;
    await act(async () => {
      titleInput.value = 'Changed run';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="save-dirty-dot"]')).not.toBeNull();

    await openSelectionTab(container);

    expect(container.querySelector('[data-testid="save-dirty-dot"]')).toBeNull();

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });

    expect(container.querySelector('[data-testid="save-dirty-dot"]')).not.toBeNull();

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Overview') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[data-testid="save-dirty-dot"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('shows dirty indicators on every Test Run workflow tab with unsaved changes', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleInput = container.querySelector('input[aria-label="Title"]') as HTMLInputElement;
    await act(async () => {
      titleInput.value = 'Changed run';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });

    expect(container.querySelector('[aria-label="Overview unsaved changes"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Select Test Case unsaved changes"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Execution unsaved changes"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('lists dirty Test Run workflow tabs in the leave-page warning', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const titleInput = container.querySelector('input[aria-label="Title"]') as HTMLInputElement;
    await act(async () => {
      titleInput.value = 'Changed run';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });

    const lastGuardCall = mocks.useFormGuard.mock.calls.at(-1);
    expect(lastGuardCall?.[0]).toBe(true);
    expect(lastGuardCall?.[1]).toContain('Are you sure?');
    expect(lastGuardCall?.[1]).toContain('Overview');
    expect(lastGuardCall?.[1]).toContain('Select Test Case');
    expect(lastGuardCall?.[1]).not.toContain('Execution');

    await act(async () => {
      root.unmount();
    });
  });

  it('guards Overview refresh while Test Run Overview has unsaved changes', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchRun).toHaveBeenCalledTimes(1);

    const titleInput = container.querySelector('input[aria-label="Title"]') as HTMLInputElement;
    await act(async () => {
      titleInput.value = 'Changed run';
      titleInput.dispatchEvent(new Event('input', { bubbles: true }));
      titleInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const refreshButton = container.querySelector('button[aria-label="Refresh"]') as HTMLButtonElement;
    expect(refreshButton.disabled).toBe(true);

    await act(async () => {
      refreshButton.click();
    });

    expect(mocks.fetchRun).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('fetches Test Run case selection from the initial Folder Scope', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenCalledWith(
      'token',
      1,
      2,
      4,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );

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
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
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
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement)
        .click();
    });

    expect(mocks.updateRunCases).toHaveBeenCalledWith(
      'token',
      2,
      [expect.objectContaining({ id: 10, RunCases: [expect.objectContaining({ editState: 'new' })] })]
    );
    expect(mocks.fetchRun).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('discards unsaved Test Run Membership changes before saving selection', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Discard') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement)
        .click();
    });

    expect(mocks.updateRunCases).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('does not save Membership drafts that return to the saved state', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Already included',
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
        RunCases: [{ id: 100, runId: 2, caseId: 10, status: 0, editState: 'notChanged' }],
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Exclude') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement)
        .click();
    });

    expect(mocks.updateRunCases).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('does not save newly included Membership drafts that are excluded before saving', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Not included',
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Exclude') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement)
        .click();
    });

    expect(mocks.updateRunCases).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('saves only changed Membership items when including a mixed selection', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Already included',
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
        RunCases: [{ id: 100, runId: 2, caseId: 10, status: 0, editState: 'notChanged' }],
      },
      {
        id: 11,
        title: 'Not included yet',
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select all visible') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement)
        .click();
    });

    expect(mocks.updateRunCases).toHaveBeenCalledWith(
      'token',
      2,
      [expect.objectContaining({ id: 11, RunCases: [expect.objectContaining({ editState: 'new' })] })]
    );

    await act(async () => {
      root.unmount();
    });
  });

  it('shows only saved Run Cases in execution while selection has unsaved Membership edits', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Pending membership',
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
    ]);
    mocks.fetchRunCases.mockResolvedValue([
      {
        id: 100,
        runId: 2,
        caseId: 20,
        status: 1,
        editState: 'notChanged',
        commentCount: 0,
        Case: {
          id: 20,
          title: 'Saved executable',
          folderPath: ['Login'],
          priority: 1,
          type: 4,
          Tags: [],
        },
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchRunCases).toHaveBeenCalledWith('token', 2);
    expect(container.textContent).toContain('Execution reflects saved Run Cases only');
    expect(container.textContent).toContain('Saved executable');
    expect(container.textContent).not.toContain('Pending membership');
    expect(mocks.updateRunCases).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('saves only changed Run Case Status drafts in execution', async () => {
    mocks.fetchRunCases.mockResolvedValue([
      {
        id: 100,
        runId: 2,
        caseId: 20,
        status: 0,
        editState: 'notChanged',
        commentCount: 0,
        Case: {
          id: 20,
          title: 'Saved executable',
          folderPath: ['Login'],
          priority: 1,
          type: 4,
          Tags: [],
        },
      },
      {
        id: 101,
        runId: 2,
        caseId: 21,
        status: 1,
        editState: 'notChanged',
        commentCount: 0,
        Case: {
          id: 21,
          title: 'Untouched executable',
          folderPath: ['Login'],
          priority: 1,
          type: 4,
          Tags: [],
        },
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const statusSelect = container.querySelector('select[aria-label="Status 20"]') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = '2';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="save-dirty-dot"]')).not.toBeNull();

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save execution') as HTMLButtonElement
      ).click();
    });

    expect(mocks.updateRunCases).toHaveBeenCalledWith(
      'token',
      2,
      [expect.objectContaining({ id: 20, RunCases: [expect.objectContaining({ id: 100, status: 2, editState: 'changed' })] })]
    );
    expect(mocks.updateRunCases).not.toHaveBeenCalledWith(
      'token',
      2,
      expect.arrayContaining([expect.objectContaining({ id: 21 })])
    );
    expect(mocks.fetchRun).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('preserves dirty execution status drafts when saving selection refreshes saved Run Cases', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Pending membership',
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
    ]);
    mocks.fetchRunCases.mockResolvedValue([
      {
        id: 100,
        runId: 2,
        caseId: 20,
        status: 0,
        editState: 'notChanged',
        commentCount: 0,
        Case: {
          id: 20,
          title: 'Saved executable',
          folderPath: ['Login'],
          priority: 1,
          type: 4,
          Tags: [],
        },
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const statusSelect = container.querySelector('select[aria-label="Status 20"]') as HTMLSelectElement;
    await act(async () => {
      statusSelect.value = '2';
      statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Include') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Save selection') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Execution') as HTMLButtonElement
      ).click();
    });

    const refreshedStatusSelect = container.querySelector('select[aria-label="Status 20"]') as HTMLSelectElement;
    expect(refreshedStatusSelect.value).toBe('2');
    expect(container.querySelector('[aria-label="Execution unsaved changes"]')).not.toBeNull();

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
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'select 10') as HTMLButtonElement)
        .click();
    });

    expect(container.textContent).toContain('1 Selected');

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'apply filter') as HTMLButtonElement)
        .click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('0 Selected');

    await act(async () => {
      root.unmount();
    });
  });

  it('filters Test Run Case Selection by Membership without sending Run Case Status filters', async () => {
    mocks.fetchProjectCases.mockResolvedValue([
      {
        id: 10,
        title: 'Already included',
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
        RunCases: [{ id: 100, runId: 2, caseId: 10, status: 0, editState: 'notChanged' }],
      },
      {
        id: 11,
        title: 'Not included',
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
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    expect(container.textContent).toContain('select 10');
    expect(container.textContent).toContain('select 11');

    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'apply included filter') as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchProjectCases).toHaveBeenLastCalledWith(
      'token',
      1,
      2,
      4,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(container.textContent).toContain('select 10');
    expect(container.textContent).not.toContain('select 11');

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
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    const countBadge = container.querySelector('[aria-label="Folder Scope Count 3"]');
    expect(countBadge).not.toBeNull();
    expect(countBadge?.getAttribute('title')).toBe('1 directly placed');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows an open folder icon for an expanded parent in the Test Run folder tree', async () => {
    mocks.openTreeNodeIds.add('4');
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
        name: 'Password reset',
        detail: '',
        projectId: 1,
        parentFolderId: 4,
        createdAt: '',
        updatedAt: '',
        Cases: [],
      },
    ]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <RunExecutionProvider>
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
          </RunExecutionProvider>
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await openSelectionTab(container);

    const icon = container.querySelector('[data-testid="tree-icon-Login"]');
    expect(icon?.querySelector('.lucide-folder-open')).not.toBeNull();
    expect(icon?.querySelector('.lucide-folder')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
