// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FoldersPane from './FoldersPane';
import { TokenContext } from '@/utils/TokenProvider';
import type { FolderType } from '@/types/folder';
import type { TokenContextType } from '@/types/user';

const mocks = vi.hoisted(() => ({
  fetchFolders: vi.fn(),
  push: vi.fn(),
  router: { push: vi.fn() },
  tree: vi.fn(),
}));

vi.mock('./foldersControl', () => ({
  fetchFolders: mocks.fetchFolders,
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));

vi.mock('@/src/i18n/routing', () => ({
  usePathname: () => '/projects/1/folders/4/cases',
  useRouter: () => mocks.router,
}));

vi.mock('@/utils/useGetCurrentIds', () => ({
  default: () => ({ projectId: 1, folderId: 4 }),
}));

vi.mock('react-arborist', () => ({
  Tree: (props: Record<string, unknown>) => {
    mocks.tree(props);
    return <div data-testid="folder-tree" />;
  },
}));

vi.mock('./FolderDialog', () => ({
  default: () => null,
}));

vi.mock('@/components/DeleteConfirmDialog', () => ({
  default: () => null,
}));

const messages = {
  folder: 'Folder',
  newFolder: 'New folder',
  editFolder: 'Edit folder',
  deleteFolder: 'Delete folder',
  folderName: 'Folder name',
  folderDetail: 'Folder detail',
  close: 'Close',
  create: 'Create',
  update: 'Update',
  pleaseEnter: 'Please enter',
  delete: 'Delete',
  areYouSure: 'Are you sure?',
};

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

const folders: FolderType[] = [
  {
    id: 4,
    name: 'Root folder',
    detail: '',
    projectId: 1,
    parentFolderId: null,
    createdAt: '',
    updatedAt: '',
    Cases: [],
  },
];

class MockResizeObserver {
  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: { height: 640 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as ResizeObserver
    );
  }

  disconnect() {}

  unobserve() {}
}

describe('FoldersPane', () => {
  beforeEach(() => {
    mocks.fetchFolders.mockResolvedValue(folders);
    mocks.router.push = mocks.push;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('sizes the virtual folder tree to the remaining vertical pane space', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <FoldersPane projectId="1" locale="en" messages={messages} />
        </TokenContext.Provider>
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const treeProps = mocks.tree.mock.calls.at(-1)?.[0];
    expect(treeProps).toEqual(expect.objectContaining({ height: 640, width: '100%' }));
    expect(container.querySelector('[data-testid="folder-tree-viewport"]')?.className).toContain('flex-1');

    await act(async () => {
      root.unmount();
    });
  });
});
