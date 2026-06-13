// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CasesPane from './CasesPane';
import { TokenContext } from '@/utils/TokenProvider';
import type { CasesMessages } from '@/types/case';
import type { TokenContextType } from '@/types/user';
import { emitMoveEvent } from '@/utils/testCaseMoveEvent';

const mocks = vi.hoisted(() => ({
  fetchCases: vi.fn(),
  createCase: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('@/utils/caseControl', () => ({
  fetchCases: mocks.fetchCases,
  createCase: mocks.createCase,
  deleteCases: vi.fn(),
  exportCases: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => mocks.searchParams,
}));

vi.mock('@/components/heroui', () => ({ addToast: vi.fn() }));

vi.mock('./TestCaseTable', () => ({
  default: ({
    cases,
    onCreateCase,
    onShowImportDialog,
    onIncludeSubfoldersChange,
    includeSubfolders,
  }: {
    cases: Array<{ id: number; title: string }>;
    onCreateCase: () => void;
    onShowImportDialog: () => void;
    onIncludeSubfoldersChange: (includeSubfolders: boolean) => void;
    includeSubfolders: boolean;
  }) => (
    <div>
      <button type="button" onClick={onCreateCase}>
        create
      </button>
      <button type="button" onClick={onShowImportDialog}>
        import
      </button>
      <button type="button" onClick={() => onIncludeSubfoldersChange(!includeSubfolders)}>
        toggle scope
      </button>
      {cases.map((testCase) => (
        <div key={testCase.id}>{testCase.title}</div>
      ))}
    </div>
  ),
}));

vi.mock('./CaseDialog', () => ({
  default: ({
    isOpen,
    onSubmit,
  }: {
    isOpen: boolean;
    onSubmit: (title: string, description: string, createMore: boolean) => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={() => onSubmit('New login', '', false)}>
        submit
      </button>
    ) : null,
}));

vi.mock('./CaseMoveDialog', () => ({
  default: ({ isOpen, onMoved }: { isOpen: boolean; onMoved: () => void }) =>
    isOpen ? (
      <button type="button" onClick={onMoved}>
        complete move
      </button>
    ) : null,
}));

vi.mock('./CaseImportDialog', () => ({
  default: ({ isOpen, folderId }: { isOpen: boolean; folderId: number }) =>
    isOpen ? <div>import folder {folderId}</div> : null,
}));

vi.mock('@/components/DeleteConfirmDialog', () => ({
  default: () => null,
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
  isProjectReporter: () => false,
  refreshProjectRoles: () => {},
  setToken: () => {},
  storeTokenToLocalStorage: () => {},
  removeTokenFromLocalStorage: () => {},
};

const messages = {
  close: 'Close',
  areYouSure: 'Are you sure?',
  delete: 'Delete',
  casesImported: 'Cases imported',
} as CasesMessages;

describe('CasesPane', () => {
  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    mocks.fetchCases.mockResolvedValue([]);
    mocks.createCase.mockResolvedValue({ id: 1, folderId: 7, title: 'New login' });
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('refreshes the current Folder Scope query after creating a Test Case', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <CasesPane
            projectId="1"
            folderId="7"
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
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector('button')?.click();
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent === 'submit'
        ) as HTMLButtonElement
      )?.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.createCase).toHaveBeenCalledWith('token', '7', 'New login', '');
    expect(mocks.fetchCases).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('refreshes the current Folder Scope query after moving selected Test Cases', async () => {
    mocks.fetchCases
      .mockResolvedValueOnce([{ id: 1, folderId: 7, title: 'Mobile login' }])
      .mockResolvedValueOnce([{ id: 1, folderId: 8, title: 'Mobile login' }]);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <CasesPane
            projectId="1"
            folderId="7"
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
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      emitMoveEvent([1], 8);
    });
    await act(async () => {
      (
        Array.from(container.querySelectorAll('button')).find(
          (button) => button.textContent === 'complete move'
        ) as HTMLButtonElement
      ).click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mocks.fetchCases).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Mobile login');

    await act(async () => {
      root.unmount();
    });
  });

  it.each([
    ['default parent Folder Scope', ''],
    ['direct-only Folder Scope', 'includeSubfolders=false'],
  ])('opens ordinary import against the current folder in %s', async (_label, queryString) => {
    mocks.searchParams = new URLSearchParams(queryString);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <CasesPane
            projectId="1"
            folderId="7"
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
          (button) => button.textContent === 'import'
        ) as HTMLButtonElement
      ).click();
    });

    expect(container.textContent).toContain('import folder 7');

    await act(async () => {
      root.unmount();
    });
  });

  it('preserves the current query when leaving direct-only Folder Scope', async () => {
    mocks.searchParams = new URLSearchParams('search=login&priority=1&includeSubfolders=false');
    window.history.pushState({}, '', '/en/projects/1/folders/7/cases?search=login&priority=1&includeSubfolders=false');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <CasesPane
            projectId="1"
            folderId="7"
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
          (button) => button.textContent === 'toggle scope'
        ) as HTMLButtonElement
      ).click();
    });

    expect(mocks.push).toHaveBeenCalledWith('/en/projects/1/folders/7/cases?search=login&priority=1', {
      scroll: false,
    });

    await act(async () => {
      root.unmount();
    });
  });
});
