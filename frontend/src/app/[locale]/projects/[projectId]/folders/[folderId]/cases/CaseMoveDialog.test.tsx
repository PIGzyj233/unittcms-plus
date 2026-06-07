// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CaseMoveDialog from './CaseMoveDialog';
import type { CasesMessages } from '@/types/case';
import { cloneCases } from '@/utils/caseControl';

vi.mock('@/components/heroui', () => ({
  addToast: vi.fn(),
  Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Modal: ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) => (isOpen ? <div>{children}</div> : null),
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Spinner: () => <div>loading</div>,
}));

vi.mock('@/utils/caseControl', () => ({
  moveCases: vi.fn(),
  cloneCases: vi.fn(),
}));

const messages = {
  selectAction: 'Select action',
  casesSelected: 'cases selected',
  close: 'Close',
  clone: 'Clone',
  move: 'Move',
  casesMoved: 'Cases moved',
  casesCloned: 'Cases cloned',
} as CasesMessages;

describe('CaseMoveDialog', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('summarizes selected Test Cases by Folder Path', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CaseMoveDialog
          isOpen={true}
          testCaseIds={[1, 2, 3]}
          selectedCases={[
            { id: 1, folderPath: ['Login', 'Mobile'] },
            { id: 2, folderPath: ['Login', 'Mobile'] },
            { id: 3, folderPath: ['Login', 'Web'] },
          ]}
          projectId="1"
          targetFolderId={2}
          isDisabled={false}
          onCancel={vi.fn()}
          onMoved={vi.fn()}
          messages={messages}
          token="token"
        />
      );
    });

    expect(container.textContent).toContain('3 cases selected');
    expect(container.textContent).toContain('Login / Mobile: 2');
    expect(container.textContent).toContain('Login / Web: 1');

    await act(async () => {
      root.unmount();
    });
  });

  it('reports changed Test Cases after cloning', async () => {
    vi.mocked(cloneCases).mockResolvedValue(true);
    const onMoved = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <CaseMoveDialog
          isOpen={true}
          testCaseIds={[1]}
          selectedCases={[{ id: 1, folderPath: ['Login'] }]}
          projectId="1"
          targetFolderId={2}
          isDisabled={false}
          onCancel={vi.fn()}
          onMoved={onMoved}
          messages={messages}
          token="token"
        />
      );
    });

    await act(async () => {
      (Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Clone') as HTMLButtonElement)
        .click();
    });

    expect(cloneCases).toHaveBeenCalledWith('token', [1], 2, 1);
    expect(onMoved).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
