// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FolderItem from './FolderItem';
import { TokenContext } from '@/utils/TokenProvider';
import type { FolderType, TreeNodeData } from '@/types/folder';
import type { TokenContextType } from '@/types/user';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/src/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('./FolderEditMenu', () => ({
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

function folder(overrides: Partial<FolderType> = {}): FolderType {
  return {
    id: 4,
    name: 'Login',
    detail: '',
    projectId: 1,
    parentFolderId: null,
    createdAt: '',
    updatedAt: '',
    Cases: [],
    caseCount: 2,
    directCaseCount: 1,
    ...overrides,
  };
}

function treeNode(folderData: FolderType): TreeNodeData {
  return {
    id: String(folderData.id),
    name: folderData.name,
    detail: folderData.detail,
    parentFolderId: folderData.parentFolderId,
    projectId: folderData.projectId,
    folderData,
    children: [],
  };
}

describe('FolderItem', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('shows Folder Scope Count as the primary folder count', async () => {
    const folderData = folder();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={tokenContext}>
          <FolderItem
            node={
              {
                data: treeNode(folderData),
                isOpen: false,
                toggle: vi.fn(),
              } as never
            }
            style={{}}
            projectId="1"
            selectedFolder={folderData}
            locale="en"
            messages={messages}
            openDialogForCreate={vi.fn()}
            onEditClick={vi.fn()}
            onDeleteClick={vi.fn()}
          />
        </TokenContext.Provider>
      );
    });

    expect(container.textContent).toContain('Login');
    expect(container.textContent).toContain('2');

    await act(async () => {
      root.unmount();
    });
  });
});
