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

function treeNode(folderData: FolderType, children: TreeNodeData[] = []): TreeNodeData {
  return {
    id: String(folderData.id),
    name: folderData.name,
    detail: folderData.detail,
    parentFolderId: folderData.parentFolderId,
    projectId: folderData.projectId,
    folderData,
    children,
  };
}

async function renderFolderItem({
  folderData,
  nodeData = treeNode(folderData),
  isOpen = false,
}: {
  folderData: FolderType;
  nodeData?: TreeNodeData;
  isOpen?: boolean;
}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <TokenContext.Provider value={tokenContext}>
        <FolderItem
          node={
            {
              data: nodeData,
              isOpen,
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

  return { container, root };
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
    const { container, root } = await renderFolderItem({ folderData });

    expect(container.textContent).toContain('Login');
    expect(container.textContent).toContain('2');

    await act(async () => {
      root.unmount();
    });
  });

  it('shows a closed folder icon when a parent folder is collapsed', async () => {
    const folderData = folder();
    const childData = folder({ id: 5, name: 'Password reset', parentFolderId: 4 });
    const parentNode = treeNode(folderData, [treeNode(childData)]);
    const { container, root } = await renderFolderItem({ folderData, nodeData: parentNode, isOpen: false });

    expect(container.querySelector('.lucide-folder')).not.toBeNull();
    expect(container.querySelector('.lucide-folder-open')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it('shows an open folder icon when a parent folder is expanded', async () => {
    const folderData = folder();
    const childData = folder({ id: 5, name: 'Password reset', parentFolderId: 4 });
    const parentNode = treeNode(folderData, [treeNode(childData)]);
    const { container, root } = await renderFolderItem({ folderData, nodeData: parentNode, isOpen: true });

    expect(container.querySelector('.lucide-folder-open')).not.toBeNull();
    expect(container.querySelector('.lucide-folder')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
