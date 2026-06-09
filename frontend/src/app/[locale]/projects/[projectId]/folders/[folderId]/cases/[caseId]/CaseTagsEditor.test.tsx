// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CaseTagsEditor from './CaseTagsEditor';
import type { CaseMessages } from '@/types/case';
import type { TokenContextType } from '@/types/user';
import { TokenContext } from '@/utils/TokenProvider';
import { fetchTags } from '@/utils/tagsControls';

vi.mock('@/components/heroui', () => ({
  addToast: vi.fn(),
  Chip: ({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose?: () => void;
  }) => (
    <span data-testid="tag-chip">
      {children}
      {onClose ? (
        <button type="button" aria-label="Remove tag" onClick={onClose}>
          remove
        </button>
      ) : null}
    </span>
  ),
  ComboBox: ({
    children,
    inputValue,
    onInputChange,
    label,
    allowsEmptyCollection,
    defaultFilter,
  }: {
    children: React.ReactNode;
    inputValue?: string;
    onInputChange?: (value: string) => void;
    label?: React.ReactNode;
    allowsEmptyCollection?: boolean;
    defaultFilter?: () => boolean;
  }) => (
    <div data-allows-empty-collection={allowsEmptyCollection} data-default-filter={Boolean(defaultFilter)}>
      <label>{label}</label>
      <input
        aria-label={typeof label === 'string' ? label : 'tags'}
        value={inputValue ?? ''}
        onChange={(event) => onInputChange?.(event.target.value)}
      />
      <div data-testid="combo-items">{children}</div>
    </div>
  ),
  ComboBoxItem: ({
    children,
    textValue,
  }: {
    children: React.ReactNode;
    textValue?: string;
  }) => <div data-testid="combo-item" data-text-value={textValue}>{children}</div>,
}));

vi.mock('@/utils/tagsControls', () => ({
  fetchTags: vi.fn(),
  createTag: vi.fn(),
}));

const messages = {
  tags: 'Tags',
  createTag: 'Create tag',
  maxTagsLimit: 'Max tags reached',
  tagAlreadyExists: 'Tag already exists',
  tagCreatedAndAdded: 'Tag created and added',
  errorCreatingTag: 'Error creating tag',
  searchOrCreateTag: 'Search or create tag',
  noTagsSelected: 'No tags selected',
} as CaseMessages;

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

function renderEditor(onChange = vi.fn(), selectedTags: { id: number; name: string }[] = []) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    container,
    root,
    onChange,
    async mount() {
      await act(async () => {
        root.render(
          <TokenContext.Provider value={tokenContext}>
            <CaseTagsEditor projectId="1" selectedTags={selectedTags} onChange={onChange} messages={messages} />
          </TokenContext.Provider>,
        );
      });
    },
    async unmount() {
      await act(async () => {
        root.unmount();
      });
    },
    getInput() {
      return container.querySelector('input') as HTMLInputElement;
    },
    getComboItems() {
      return Array.from(container.querySelectorAll('[data-testid="combo-item"]')).map((item) => ({
        text: item.textContent,
        textValue: item.getAttribute('data-text-value'),
      }));
    },
  };
}

describe('CaseTagsEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.mocked(fetchTags).mockResolvedValue([
      { id: 1, name: 'smoke' },
      { id: 2, name: 'regression' },
    ]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  it('shows create option immediately when typing a new tag name', async () => {
    const view = renderEditor();
    await view.mount();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(view.getInput(), 'brand-new');
      view.getInput().dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(view.getComboItems()).toEqual([
      {
        text: 'Create tag "brand-new"',
        textValue: 'brand-new',
      },
    ]);

    await view.unmount();
  });

  it('shows matching tags and hides create option for existing tag prefixes', async () => {
    const view = renderEditor();
    await view.mount();

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(view.getInput(), 'smo');
      view.getInput().dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(view.getComboItems()).toEqual([
      {
        text: 'smoke',
        textValue: 'smoke',
      },
    ]);

    await view.unmount();
  });

  it('does not show create option when input is empty', async () => {
    const view = renderEditor();
    await view.mount();

    expect(view.getComboItems()).toEqual([
      { text: 'smoke', textValue: 'smoke' },
      { text: 'regression', textValue: 'regression' },
    ]);

    await view.unmount();
  });

  it('passes allowsEmptyCollection and defaultFilter to ComboBox', async () => {
    const view = renderEditor();
    await view.mount();

    const comboBox = view.container.querySelector('[data-allows-empty-collection]');
    expect(comboBox?.getAttribute('data-allows-empty-collection')).toBe('true');
    expect(comboBox?.getAttribute('data-default-filter')).toBe('true');

    await view.unmount();
  });

  it('removes a selected tag when the chip close button is pressed', async () => {
    const onChange = vi.fn();
    const view = renderEditor(onChange, [{ id: 1, name: 'smoke' }]);
    await view.mount();

    await act(async () => {
      (view.container.querySelector('[aria-label="Remove tag"]') as HTMLButtonElement).click();
    });

    expect(onChange).toHaveBeenCalledWith([]);

    await view.unmount();
  });

  it('does not show remove button for non-developers', async () => {
    const readOnlyContext: TokenContextType = {
      ...tokenContext,
      isProjectDeveloper: () => false,
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TokenContext.Provider value={readOnlyContext}>
          <CaseTagsEditor
            projectId="1"
            selectedTags={[{ id: 1, name: 'smoke' }]}
            onChange={vi.fn()}
            messages={messages}
          />
        </TokenContext.Provider>,
      );
    });

    expect(container.querySelector('[aria-label="Remove tag"]')).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
