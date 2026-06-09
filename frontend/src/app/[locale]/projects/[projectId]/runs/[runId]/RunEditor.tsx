'use client';
import { useState, useEffect, useContext } from 'react';
import type { Key } from 'react';
import {
  Save,
  ArrowLeft,
  ChevronDown,
  CopyPlus,
  CopyMinus,
  RotateCw,
  FileDown,
  FileSpreadsheet,
  FileCode,
  FileJson,
  ChevronRight,
  Folder,
  FolderOpen,
  Filter,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { NodeApi, Tree } from 'react-arborist';
import {
  fetchRun,
  fetchRunCases,
  updateRun,
  updateRunCases,
  fetchProjectCases,
  includeExcludeTestCases,
  exportRun,
} from '../runsControl';
import { fetchFolders } from '../../folders/foldersControl';
import RunProgressChart from './RunPregressDonutChart';
import ExecutionRunFilter from './ExecutionRunFilter';
import TestCaseSelector from './TestCaseSelector';
import TestRunFilter from './TestRunFilter';
import type { TestRunMembershipFilter } from './TestRunFilter';
import {
  Button,
  Input,
  TextArea,
  Select,
  SelectItem,
  Tooltip,
  Selection,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  addToast,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Checkbox,
  Tabs,
  Tab,
} from '@/components/heroui';
import { useRouter } from '@/src/i18n/routing';
import { testRunCaseStatus, testRunStatus } from '@/config/selection';
import { RunType, RunCaseType, RunStatusCountType, RunMessages } from '@/types/run';
import { CaseType } from '@/types/case';
import { TreeNodeData } from '@/types/folder';
import { TokenContext } from '@/utils/TokenProvider';
import { useFormGuard } from '@/utils/formGuard';
import { PriorityMessages } from '@/types/priority';
import { RunStatusMessages, TestRunCaseStatusMessages } from '@/types/status';
import { TestTypeMessages } from '@/types/testType';
import { logError } from '@/utils/errorHandler';
import TreeItem from '@/components/TreeItem';
import { buildFolderTree } from '@/utils/buildFolderTree';

const defaultTestRun = {
  id: 0,
  name: '',
  configurations: 0,
  description: '',
  state: 0,
  projectId: 0,
  createdAt: '',
  updatedAt: '',
};

type EditableRunCase = NonNullable<CaseType['RunCases']>[number];
const workflowTabs = ['overview', 'selection', 'execution'] as const;
type TestRunWorkflow = (typeof workflowTabs)[number];

function workflowFromCurrentUrl(): TestRunWorkflow {
  if (typeof window === 'undefined') {
    return 'overview';
  }

  const tab = new URLSearchParams(window.location.search).get('tab');
  return workflowTabs.includes(tab as TestRunWorkflow) ? (tab as TestRunWorkflow) : 'overview';
}

function currentUrlSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
}

function selectionIncludeSubfoldersFromCurrentUrl() {
  return currentUrlSearchParams().get('selectionIncludeSubfolders') !== 'false';
}

function selectionFolderIdFromCurrentUrl() {
  const folderId = currentUrlSearchParams().get('selectionFolderId');
  if (!folderId) {
    return null;
  }

  const parsed = Number(folderId);
  return Number.isInteger(parsed) ? parsed : null;
}

function selectionSearchFromCurrentUrl() {
  return currentUrlSearchParams().get('selectionSearch') || '';
}

function selectionMembershipFromCurrentUrl(): TestRunMembershipFilter {
  const membership = currentUrlSearchParams().get('selectionMembership');
  return membership === 'included' || membership === 'notIncluded' ? membership : 'all';
}

function selectionTagsFromCurrentUrl() {
  const tags = currentUrlSearchParams().get('selectionTags');
  if (!tags) {
    return [];
  }

  return tags
    .split(',')
    .map((tag) => Number(tag.trim()))
    .filter((tag) => Number.isInteger(tag));
}

function selectionNumberListFromCurrentUrl(paramName: string) {
  const values = currentUrlSearchParams().get(paramName);
  if (!values) {
    return [];
  }

  return values
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
}

function executionIncludeSubfoldersFromCurrentUrl() {
  return currentUrlSearchParams().get('executionIncludeSubfolders') !== 'false';
}

function executionFolderIdFromCurrentUrl() {
  const folderId = currentUrlSearchParams().get('executionFolderId');
  if (!folderId) {
    return null;
  }

  const parsed = Number(folderId);
  return Number.isInteger(parsed) ? parsed : null;
}

function executionSearchFromCurrentUrl() {
  return currentUrlSearchParams().get('executionSearch') || '';
}

function executionNumberListFromCurrentUrl(paramName: string) {
  const values = currentUrlSearchParams().get(paramName);
  if (!values) {
    return [];
  }

  return values
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));
}

function findTreeNodeById(nodes: TreeNodeData[], id: number): TreeNodeData | null {
  for (const node of nodes) {
    if (Number(node.id) === id) {
      return node;
    }

    const childMatch = node.children ? findTreeNodeById(node.children, id) : null;
    if (childMatch) {
      return childMatch;
    }
  }

  return null;
}

function updateCurrentUrlParams(update: (params: URLSearchParams) => void) {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  update(params);
  const queryString = params.toString();
  window.history.pushState({}, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`);
}

type Props = {
  projectId: string;
  runId: string;
  messages: RunMessages;
  runStatusMessages: RunStatusMessages;
  testRunCaseStatusMessages: TestRunCaseStatusMessages;
  priorityMessages: PriorityMessages;
  testTypeMessages: TestTypeMessages;
  locale: string;
};

export default function RunEditor({
  projectId,
  runId,
  messages,
  runStatusMessages,
  testRunCaseStatusMessages,
  priorityMessages,
  testTypeMessages,
  locale,
}: Props) {
  const tokenContext = useContext(TokenContext);
  const { theme } = useTheme();
  const [testRun, setTestRun] = useState<RunType>(defaultTestRun);
  const [savedTestRun, setSavedTestRun] = useState<RunType>(defaultTestRun);
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [runStatusCounts, setRunStatusCounts] = useState<RunStatusCountType[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Selection>(new Set([]));
  const [selectedFolder, setSelectedFolder] = useState<TreeNodeData | null>(null);
  const [executionSelectedFolder, setExecutionSelectedFolder] = useState<TreeNodeData | null>(null);
  const [testCases, setTestCases] = useState<CaseType[]>([]);
  const [filteredTestCases, setFilteredTestCases] = useState<CaseType[]>([]);
  const [executionRunCases, setExecutionRunCases] = useState<RunCaseType[]>([]);
  const [savedExecutionRunCases, setSavedExecutionRunCases] = useState<RunCaseType[]>([]);
  const [isNameInvalid] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isOverviewDirty, setIsOverviewDirty] = useState(false);
  const [searchFilter, setSearchFilter] = useState(() => selectionSearchFromCurrentUrl());
  const [membershipFilter, setMembershipFilter] = useState<TestRunMembershipFilter>(() => selectionMembershipFromCurrentUrl());
  const [tagFilter, setTagFilter] = useState<number[]>(() => selectionTagsFromCurrentUrl());
  const [priorityFilter, setPriorityFilter] = useState<number[]>(() => selectionNumberListFromCurrentUrl('selectionPriorities'));
  const [typeFilter, setTypeFilter] = useState<number[]>(() => selectionNumberListFromCurrentUrl('selectionTypes'));
  const [includeSubfolders, setIncludeSubfolders] = useState(() => selectionIncludeSubfoldersFromCurrentUrl());
  const [executionSearchFilter, setExecutionSearchFilter] = useState(() => executionSearchFromCurrentUrl());
  const [executionStatusFilter, setExecutionStatusFilter] = useState<number[]>(() =>
    executionNumberListFromCurrentUrl('executionStatus')
  );
  const [executionTagFilter, setExecutionTagFilter] = useState<number[]>(() =>
    executionNumberListFromCurrentUrl('executionTags')
  );
  const [executionPriorityFilter, setExecutionPriorityFilter] = useState<number[]>(() =>
    executionNumberListFromCurrentUrl('executionPriorities')
  );
  const [executionTypeFilter, setExecutionTypeFilter] = useState<number[]>(() =>
    executionNumberListFromCurrentUrl('executionTypes')
  );
  const [executionFolderId, setExecutionFolderId] = useState<number | null>(() => executionFolderIdFromCurrentUrl());
  const [executionIncludeSubfolders, setExecutionIncludeSubfolders] = useState(() =>
    executionIncludeSubfoldersFromCurrentUrl()
  );
  const [runCaseEditsByCaseId, setRunCaseEditsByCaseId] = useState<Map<number, EditableRunCase>>(new Map());
  const [runCaseStatusEditsByRunCaseId, setRunCaseStatusEditsByRunCaseId] = useState<Map<number, EditableRunCase>>(
    new Map()
  );
  const [activeWorkflow, setActiveWorkflow] = useState<TestRunWorkflow>(() => workflowFromCurrentUrl());
  const [hasLoadedExecutionRunCases, setHasLoadedExecutionRunCases] = useState(false);
  const router = useRouter();
  const isSelectionDirty = runCaseEditsByCaseId.size > 0;
  const isExecutionDirty = runCaseStatusEditsByRunCaseId.size > 0;
  const isDirty = isOverviewDirty || isSelectionDirty || isExecutionDirty;
  const dirtyWorkflowLabels = [
    isOverviewDirty ? messages.testRunOverview : null,
    isSelectionDirty ? messages.selectTestCase : null,
    isExecutionDirty ? messages.runCaseExecution : null,
  ].filter((label): label is string => Boolean(label));
  const leaveWarningMessage =
    dirtyWorkflowLabels.length > 0
      ? `${messages.areYouSureLeave}\n${messages.unsavedChanges}: ${dirtyWorkflowLabels.join(', ')}`
      : messages.areYouSureLeave;

  // not show warning when navigating to test case detail page
  useFormGuard(isDirty, leaveWarningMessage, [`/projects/${projectId}/runs/${runId}/cases/\\d+`]);

  const fetchRunAndStatusCount = async () => {
    const { run, statusCounts } = await fetchRun(tokenContext.token.access_token, Number(runId));
    setTestRun(run);
    setSavedTestRun(run);
    setRunStatusCounts(statusCounts);
  };

  const applyRunCaseStatusEdits = (runCases: RunCaseType[], edits: Map<number, EditableRunCase>) => {
    return runCases.map((runCase) => {
      const editedRunCase = edits.get(runCase.id);
      if (!editedRunCase) {
        return { ...runCase, editState: 'notChanged' as const };
      }
      return {
        ...runCase,
        status: editedRunCase.status,
        editState: editedRunCase.editState,
      };
    });
  };

  const executionFetchFilters = (
    search = executionSearchFilter,
    status = executionStatusFilter,
    tag = executionTagFilter,
    priority = executionPriorityFilter,
    type = executionTypeFilter,
    folderId = executionFolderId,
    nextIncludeSubfolders = executionIncludeSubfolders
  ) => {
    const filters: {
      search?: string;
      status?: string[];
      tag?: string[];
      priority?: string[];
      type?: string[];
      folderId?: number;
      includeSubfolders?: boolean;
    } = {};

    if (search) {
      filters.search = search;
    }
    if (status.length > 0) {
      filters.status = status.map(String);
    }
    if (tag.length > 0) {
      filters.tag = tag.map(String);
    }
    if (priority.length > 0) {
      filters.priority = priority.map(String);
    }
    if (type.length > 0) {
      filters.type = type.map(String);
    }
    if (folderId !== null) {
      filters.folderId = folderId;
      if (!nextIncludeSubfolders) {
        filters.includeSubfolders = false;
      }
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  };

  const initExecutionRunCases = async (
    statusEdits = runCaseStatusEditsByRunCaseId,
    filters = executionFetchFilters()
  ) => {
    const runCases = filters
      ? await fetchRunCases(tokenContext.token.access_token, Number(runId), filters)
      : await fetchRunCases(tokenContext.token.access_token, Number(runId));
    const savedRunCases = (runCases || []).map((runCase: RunCaseType) => ({ ...runCase, editState: 'notChanged' as const }));
    setExecutionRunCases(applyRunCaseStatusEdits(savedRunCases, statusEdits));
    setSavedExecutionRunCases(savedRunCases);
    setHasLoadedExecutionRunCases(true);
  };

  const applyRunCaseEdits = (casesData: CaseType[], edits: Map<number, EditableRunCase>) => {
    return casesData.map((testCase: CaseType) => {
      const normalizedCase = { ...testCase };
      if (normalizedCase.RunCases && normalizedCase.RunCases.length > 0) {
        normalizedCase.RunCases = [{ ...normalizedCase.RunCases[0], editState: 'notChanged' }];
      }

      const editedRunCase = edits.get(normalizedCase.id);
      if (editedRunCase) {
        normalizedCase.RunCases = [{ ...(normalizedCase.RunCases?.[0] || {}), ...editedRunCase }];
      }
      return normalizedCase;
    });
  };

  const filterCasesByMembership = (casesData: CaseType[], membership: TestRunMembershipFilter) => {
    if (membership === 'all') {
      return casesData;
    }

    return casesData.filter((testCase) => {
      const runCase = testCase.RunCases?.[0];
      const isIncluded = Boolean(runCase && runCase.editState !== 'deleted');
      return membership === 'included' ? isIncluded : !isIncluded;
    });
  };

  const initTestCases = async (
    folder: TreeNodeData | null = selectedFolder,
    nextIncludeSubfolders = includeSubfolders,
    search = searchFilter,
    membership = membershipFilter,
    tag: string[] = tagFilter.map(String),
    priority: string[] = priorityFilter.map(String),
    type: string[] = typeFilter.map(String),
    edits = runCaseEditsByCaseId
  ) => {
    const casesData = await fetchProjectCases(
      tokenContext.token.access_token,
      Number(projectId),
      Number(runId),
      folder ? Number(folder.id) : undefined,
      nextIncludeSubfolders,
      search || undefined,
      undefined,
      tag.length > 0 ? tag : undefined,
      priority.length > 0 ? priority : undefined,
      type.length > 0 ? type : undefined
    );
    const normalizedCases = applyRunCaseEdits(casesData || [], edits);
    setTestCases(normalizedCases);
    setFilteredTestCases(filterCasesByMembership(normalizedCases, membership));
  };

  const isSignedIn = tokenContext.isSignedIn();
  useEffect(() => {
    if (!isSignedIn) return;

    async function fetchDataEffect() {
      if (!tokenContext.isSignedIn()) {
        return;
      }

      try {
        await fetchRunAndStatusCount();
        const foldersData = await fetchFolders(tokenContext.token.access_token, Number(projectId));
        const tree = buildFolderTree(foldersData);
        setTreeData(tree);
        const urlSelectionFolderId = selectionFolderIdFromCurrentUrl();
        const initialFolder = urlSelectionFolderId ? findTreeNodeById(tree, urlSelectionFolderId) || tree[0] || null : tree[0] || null;
        const initialIncludeSubfolders = selectionIncludeSubfoldersFromCurrentUrl();
        const initialSearch = selectionSearchFromCurrentUrl();
        const initialMembership = selectionMembershipFromCurrentUrl();
        const initialTags = selectionTagsFromCurrentUrl();
        const initialPriorities = selectionNumberListFromCurrentUrl('selectionPriorities');
        const initialTypes = selectionNumberListFromCurrentUrl('selectionTypes');
        const initialExecutionFolderId = executionFolderIdFromCurrentUrl();
        const initialExecutionFolder = initialExecutionFolderId ? findTreeNodeById(tree, initialExecutionFolderId) : null;
        setSelectedFolder(initialFolder);
        setExecutionSelectedFolder(initialExecutionFolder);
        setExecutionFolderId(initialExecutionFolderId);
        setExecutionIncludeSubfolders(executionIncludeSubfoldersFromCurrentUrl());
        setIncludeSubfolders(initialIncludeSubfolders);
        setSearchFilter(initialSearch);
        setMembershipFilter(initialMembership);
        setTagFilter(initialTags);
        setPriorityFilter(initialPriorities);
        setTypeFilter(initialTypes);
        await initTestCases(
          initialFolder,
          initialIncludeSubfolders,
          initialSearch,
          initialMembership,
          initialTags.map(String),
          initialPriorities.map(String),
          initialTypes.map(String)
        );
      } catch (error: unknown) {
        logError('Error fetching run data', error);
      }
    }

    fetchDataEffect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || activeWorkflow !== 'execution' || hasLoadedExecutionRunCases) return;

    initExecutionRunCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkflow, isSignedIn, hasLoadedExecutionRunCases]);

  const rememberRunCaseEdits = (nextTestCases: CaseType[], caseIds: number[]) => {
    setRunCaseEditsByCaseId((prev) => {
      const next = new Map(prev);
      caseIds.forEach((caseId) => {
        const testCase = nextTestCases.find((entry) => entry.id === caseId);
        const runCase = testCase?.RunCases?.[0];
        if (runCase && runCase.editState !== 'notChanged') {
          next.set(caseId, { ...runCase });
        } else {
          next.delete(caseId);
        }
      });
      return next;
    });
  };

  const handleBulkIncludeExcludeCases = async (isInclude: boolean) => {
    let keys: number[] = [];
    if (selectedKeys === 'all') {
      keys = filteredTestCases.map((item) => item.id);
    } else {
      keys = Array.from(selectedKeys).map(Number);
    }

    const newTestCases = includeExcludeTestCases(isInclude, keys, Number(runId), testCases);
    setTestCases(newTestCases);
    setFilteredTestCases(filterCasesByMembership(newTestCases, membershipFilter));
    rememberRunCaseEdits(newTestCases, keys);
    setSelectedKeys(new Set([]));
  };

  const onSaveOverview = async () => {
    setIsUpdating(true);
    const savedRun = await updateRun(tokenContext.token.access_token, testRun);
    setSavedTestRun(savedRun || testRun);
    addToast({
      title: 'Success',
      color: 'success',
      description: messages.updatedTestRun,
    });
    setIsUpdating(false);
    setIsOverviewDirty(false);
  };

  const onDiscardOverview = () => {
    setTestRun(savedTestRun);
    setIsOverviewDirty(false);
  };

  const onSaveSelection = async () => {
    if (runCaseEditsByCaseId.size === 0) {
      return;
    }

    setIsUpdating(true);
    const dirtyTestCases = Array.from(runCaseEditsByCaseId.entries()).map(
      ([caseId, runCase]) =>
        ({
          id: caseId,
          RunCases: [runCase],
        }) as CaseType
    );
    const clearedEdits = new Map<number, EditableRunCase>();
    try {
      await updateRunCases(tokenContext.token.access_token, Number(runId), dirtyTestCases);
      setRunCaseEditsByCaseId(clearedEdits);
      await initTestCases(
        selectedFolder,
        includeSubfolders,
        searchFilter,
        membershipFilter,
        tagFilter.map(String),
        priorityFilter.map(String),
        typeFilter.map(String),
        clearedEdits
      );
      await fetchRunAndStatusCount();
      await initExecutionRunCases();

      addToast({
        title: 'Success',
        color: 'success',
        description: messages.updatedTestRun,
      });
    } catch (error: unknown) {
      logError('Error saving run case selection:', error);
      setRunCaseEditsByCaseId(clearedEdits);
      setSelectedKeys(new Set([]));
      await initTestCases(
        selectedFolder,
        includeSubfolders,
        searchFilter,
        membershipFilter,
        tagFilter.map(String),
        priorityFilter.map(String),
        typeFilter.map(String),
        clearedEdits
      );
      await initExecutionRunCases();
      await fetchRunAndStatusCount();
      addToast({
        title: 'Error',
        color: 'danger',
        description: messages.runCaseSaveConflict,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const onDiscardSelection = async () => {
    const clearedEdits = new Map<number, EditableRunCase>();
    setRunCaseEditsByCaseId(clearedEdits);
    setSelectedKeys(new Set([]));
    await initTestCases(
      selectedFolder,
      includeSubfolders,
      searchFilter,
      membershipFilter,
      tagFilter.map(String),
      priorityFilter.map(String),
      typeFilter.map(String),
      clearedEdits
    );
  };

  const handleRunCaseStatusChange = (runCase: RunCaseType, nextStatus: number) => {
    const savedRunCase = savedExecutionRunCases.find((saved) => saved.id === runCase.id) || runCase;

    setExecutionRunCases((prev) =>
      prev.map((item) =>
        item.id === runCase.id
          ? {
              ...item,
              status: nextStatus,
              editState: nextStatus === savedRunCase.status ? 'notChanged' : 'changed',
            }
          : item
      )
    );
    setRunCaseStatusEditsByRunCaseId((prev) => {
      const next = new Map(prev);
      if (nextStatus === savedRunCase.status) {
        next.delete(runCase.id);
      } else {
        next.set(runCase.id, {
          id: runCase.id,
          runId: runCase.runId,
          caseId: runCase.caseId,
          status: nextStatus,
          editState: 'changed',
        });
      }
      return next;
    });
  };

  const onSaveExecution = async () => {
    if (runCaseStatusEditsByRunCaseId.size === 0) {
      return;
    }

    setIsUpdating(true);
    const dirtyTestCases = Array.from(runCaseStatusEditsByRunCaseId.values()).map(
      (runCase) =>
        ({
          id: runCase.caseId,
          RunCases: [runCase],
        }) as CaseType
    );
    const clearedEdits = new Map<number, EditableRunCase>();
    try {
      await updateRunCases(tokenContext.token.access_token, Number(runId), dirtyTestCases);
      setRunCaseStatusEditsByRunCaseId(clearedEdits);
      await initExecutionRunCases(clearedEdits);
      await fetchRunAndStatusCount();

      addToast({
        title: 'Success',
        color: 'success',
        description: messages.updatedTestRun,
      });
    } catch (error: unknown) {
      logError('Error saving run case execution:', error);
      setRunCaseStatusEditsByRunCaseId(clearedEdits);
      await initExecutionRunCases(clearedEdits);
      await fetchRunAndStatusCount();
      addToast({
        title: 'Error',
        color: 'danger',
        description: messages.runCaseSaveConflict,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const onDiscardExecution = () => {
    setRunCaseStatusEditsByRunCaseId(new Map());
    setExecutionRunCases(savedExecutionRunCases);
  };

  const onSave =
    activeWorkflow === 'selection'
      ? onSaveSelection
      : activeWorkflow === 'execution'
        ? onSaveExecution
        : onSaveOverview;
  const saveLabel =
    activeWorkflow === 'selection'
      ? messages.saveSelection
      : activeWorkflow === 'execution'
        ? messages.saveExecution
        : messages.saveOverview;
  const isSaveDisabled = !tokenContext.isProjectReporter(Number(projectId));
  const onDiscard =
    activeWorkflow === 'selection'
      ? onDiscardSelection
      : activeWorkflow === 'execution'
        ? onDiscardExecution
        : onDiscardOverview;
  const isActiveWorkflowDirty =
    activeWorkflow === 'selection'
      ? isSelectionDirty
      : activeWorkflow === 'execution'
        ? isExecutionDirty
        : isOverviewDirty;
  const workflowDirtyState: Record<TestRunWorkflow, boolean> = {
    overview: isOverviewDirty,
    selection: isSelectionDirty,
    execution: isExecutionDirty,
  };
  const workflowLabels: Record<TestRunWorkflow, string> = {
    overview: messages.testRunOverview,
    selection: messages.selectTestCase,
    execution: messages.runCaseExecution,
  };
  const renderWorkflowTitle = (workflow: TestRunWorkflow) => {
    const label = workflowLabels[workflow];
    return (
      <span className="inline-flex items-center gap-2">
        {label}
        {workflowDirtyState[workflow] && (
          <span
            aria-label={`${label} ${messages.unsavedChanges}`}
            className="inline-block h-2 w-2 flex-shrink-0 rounded-full bg-danger"
          />
        )}
      </span>
    );
  };
  const executionDetailQuery = () => {
    const params = new URLSearchParams();
    params.set('tab', 'execution');
    if (executionSearchFilter) {
      params.set('executionSearch', executionSearchFilter);
    }
    if (executionStatusFilter.length > 0) {
      params.set('executionStatus', executionStatusFilter.join(','));
    }
    if (executionTagFilter.length > 0) {
      params.set('executionTags', executionTagFilter.join(','));
    }
    if (executionPriorityFilter.length > 0) {
      params.set('executionPriorities', executionPriorityFilter.join(','));
    }
    if (executionTypeFilter.length > 0) {
      params.set('executionTypes', executionTypeFilter.join(','));
    }
    if (executionFolderId !== null) {
      params.set('executionFolderId', String(executionFolderId));
      if (!executionIncludeSubfolders) {
        params.set('executionIncludeSubfolders', 'false');
      }
    }
    return params.toString();
  };
  const selectedCaseCount = selectedKeys === 'all' ? filteredTestCases.length : selectedKeys.size;
  const hasSelectedCaseRows = selectedCaseCount > 0;

  // **************************************************************************
  // Filter
  // **************************************************************************
  const [showFilter, setShowFilter] = useState(false);
  const [activeFilterNum, setActiveFilterNum] = useState(0);
  const [showExecutionFilter, setShowExecutionFilter] = useState(false);
  const [activeExecutionFilterNum, setActiveExecutionFilterNum] = useState(
    (executionSearchFilter ? 1 : 0) +
      (executionStatusFilter.length > 0 ? 1 : 0) +
      (executionTagFilter.length > 0 ? 1 : 0) +
      (executionPriorityFilter.length > 0 ? 1 : 0) +
      (executionTypeFilter.length > 0 ? 1 : 0)
  );

  const onFilterChange = async (
    search: string,
    membership: TestRunMembershipFilter,
    tag: number[],
    priority: number[],
    type: number[]
  ) => {
    setSearchFilter(search);
    setMembershipFilter(membership);
    setTagFilter(tag);
    setPriorityFilter(priority);
    setTypeFilter(type);
    setSelectedKeys(new Set([]));
    setActiveFilterNum(
      (search ? 1 : 0) +
        (membership !== 'all' ? 1 : 0) +
        (tag.length > 0 ? 1 : 0) +
        (priority.length > 0 ? 1 : 0) +
        (type.length > 0 ? 1 : 0)
    );
    writeSelectionFiltersToUrl(search, membership, tag, priority, type);
    await initTestCases(
      selectedFolder,
      includeSubfolders,
      search,
      membership,
      tag.map(String),
      priority.map(String),
      type.map(String)
    );
  };

  const writeExecutionFiltersToUrl = (
    search: string,
    status: number[],
    tags: number[],
    priorities: number[],
    types: number[]
  ) => {
    updateCurrentUrlParams((params) => {
      params.set('tab', 'execution');
      if (search) {
        params.set('executionSearch', search);
      } else {
        params.delete('executionSearch');
      }

      if (status.length > 0) {
        params.set('executionStatus', status.join(','));
      } else {
        params.delete('executionStatus');
      }

      if (tags.length > 0) {
        params.set('executionTags', tags.join(','));
      } else {
        params.delete('executionTags');
      }

      if (priorities.length > 0) {
        params.set('executionPriorities', priorities.join(','));
      } else {
        params.delete('executionPriorities');
      }

      if (types.length > 0) {
        params.set('executionTypes', types.join(','));
      } else {
        params.delete('executionTypes');
      }
    });
  };

  const writeExecutionScopeToUrl = (folderId: number | null, nextIncludeSubfolders = executionIncludeSubfolders) => {
    updateCurrentUrlParams((params) => {
      params.set('tab', 'execution');
      if (folderId !== null) {
        params.set('executionFolderId', String(folderId));
        if (nextIncludeSubfolders) {
          params.delete('executionIncludeSubfolders');
        } else {
          params.set('executionIncludeSubfolders', 'false');
        }
      } else {
        params.delete('executionFolderId');
        params.delete('executionIncludeSubfolders');
      }
    });
  };

  const onExecutionFilterChange = async (
    search: string,
    status: number[],
    tag: number[],
    priority: number[],
    type: number[]
  ) => {
    setExecutionSearchFilter(search);
    setExecutionStatusFilter(status);
    setExecutionTagFilter(tag);
    setExecutionPriorityFilter(priority);
    setExecutionTypeFilter(type);
    setActiveExecutionFilterNum(
      (search ? 1 : 0) +
        (status.length > 0 ? 1 : 0) +
        (tag.length > 0 ? 1 : 0) +
        (priority.length > 0 ? 1 : 0) +
        (type.length > 0 ? 1 : 0)
    );
    writeExecutionFiltersToUrl(search, status, tag, priority, type);
    await initExecutionRunCases(
      runCaseStatusEditsByRunCaseId,
      executionFetchFilters(search, status, tag, priority, type, executionFolderId, executionIncludeSubfolders)
    );
  };

  const handleExecutionFolderChange = async (folder: TreeNodeData) => {
    const nextFolderId = Number(folder.id);
    setExecutionSelectedFolder(folder);
    setExecutionFolderId(nextFolderId);
    writeExecutionScopeToUrl(nextFolderId);
    await initExecutionRunCases(
      runCaseStatusEditsByRunCaseId,
      executionFetchFilters(
        executionSearchFilter,
        executionStatusFilter,
        executionTagFilter,
        executionPriorityFilter,
        executionTypeFilter,
        nextFolderId,
        executionIncludeSubfolders
      )
    );
  };

  const handleExecutionIncludeSubfoldersChange = async (selected: boolean) => {
    setExecutionIncludeSubfolders(selected);
    writeExecutionScopeToUrl(executionFolderId, selected);
    await initExecutionRunCases(
      runCaseStatusEditsByRunCaseId,
      executionFetchFilters(
        executionSearchFilter,
        executionStatusFilter,
        executionTagFilter,
        executionPriorityFilter,
        executionTypeFilter,
        executionFolderId,
        selected
      )
    );
  };

  const handleClearExecutionFolderScope = async () => {
    setExecutionSelectedFolder(null);
    setExecutionFolderId(null);
    writeExecutionScopeToUrl(null);
    await initExecutionRunCases(
      runCaseStatusEditsByRunCaseId,
      executionFetchFilters(
        executionSearchFilter,
        executionStatusFilter,
        executionTagFilter,
        executionPriorityFilter,
        executionTypeFilter,
        null,
        executionIncludeSubfolders
      )
    );
  };

  const handleIncludeSubfoldersChange = async (selected: boolean) => {
    setIncludeSubfolders(selected);
    setSelectedKeys(new Set([]));
    writeSelectionScopeToUrl(selectedFolder, selected);
    await initTestCases(selectedFolder, selected);
  };

  const writeSelectionScopeToUrl = (folder: TreeNodeData | null, nextIncludeSubfolders = includeSubfolders) => {
    updateCurrentUrlParams((params) => {
      params.set('tab', 'selection');
      if (folder) {
        params.set('selectionFolderId', String(folder.id));
      } else {
        params.delete('selectionFolderId');
      }

      if (nextIncludeSubfolders) {
        params.delete('selectionIncludeSubfolders');
      } else {
        params.set('selectionIncludeSubfolders', 'false');
      }
    });
  };

  const writeSelectionFiltersToUrl = (
    search: string,
    membership: TestRunMembershipFilter,
    tags: number[],
    priorities: number[],
    types: number[]
  ) => {
    updateCurrentUrlParams((params) => {
      params.set('tab', 'selection');
      if (search) {
        params.set('selectionSearch', search);
      } else {
        params.delete('selectionSearch');
      }

      if (membership === 'all') {
        params.delete('selectionMembership');
      } else {
        params.set('selectionMembership', membership);
      }

      if (tags.length > 0) {
        params.set('selectionTags', tags.join(','));
      } else {
        params.delete('selectionTags');
      }

      if (priorities.length > 0) {
        params.set('selectionPriorities', priorities.join(','));
      } else {
        params.delete('selectionPriorities');
      }

      if (types.length > 0) {
        params.set('selectionTypes', types.join(','));
      } else {
        params.delete('selectionTypes');
      }
    });
  };

  const handleWorkflowChange = (key: Key) => {
    const nextWorkflow = workflowTabs.includes(String(key) as TestRunWorkflow)
      ? (String(key) as TestRunWorkflow)
      : 'overview';
    setActiveWorkflow(nextWorkflow);

    updateCurrentUrlParams((params) => {
      if (nextWorkflow === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', nextWorkflow);
      }
    });
  };

  return (
    <>
      <div className="border-b-1 dark:border-neutral-700 w-full p-3 flex items-center justify-between">
        <div className="flex items-center">
          <Tooltip content={messages.backToRuns}>
            <Button
              isIconOnly
              size="sm"
              className="rounded-full bg-neutral-50 dark:bg-neutral-600"
              onPress={() => router.push(`/projects/${projectId}/runs`, { locale: locale })}
            >
              <ArrowLeft size={16} />
            </Button>
          </Tooltip>
          <h3 className="font-bold ms-2">{testRun.name}</h3>
        </div>
        <div className="flex items-center">
          {activeWorkflow === 'selection' && (
            <Popover placement="bottom" isOpen={showFilter} onOpenChange={(open) => setShowFilter(open)}>
              <Badge
                color="danger"
                content={activeFilterNum}
                isInvisible={activeFilterNum === 0}
                shape="circle"
                placement="top-left"
              >
                <PopoverTrigger>
                  <Button
                    startContent={<Filter size={16} />}
                    endContent={<ChevronDown size={16} />}
                    size="sm"
                    variant="bordered"
                    className="me-2"
                  >
                    {messages.filter}
                  </Button>
                </PopoverTrigger>
              </Badge>
              <PopoverContent>
                <TestRunFilter
                  messages={messages}
                  activeSearchFilter={searchFilter}
                  activeMembershipFilter={membershipFilter}
                  activeTagFilters={tagFilter}
                  activePriorityFilters={priorityFilter}
                  activeTypeFilters={typeFilter}
                  projectId={projectId}
                  priorityMessages={priorityMessages}
                  testTypeMessages={testTypeMessages}
                  onFilterChange={(newTitleFilter, newMembershipFilter, newTagFilters, newPriorityFilters, newTypeFilters) => {
                    setShowFilter(false);
                    onFilterChange(
                      newTitleFilter,
                      newMembershipFilter,
                      newTagFilters,
                      newPriorityFilters,
                      newTypeFilters
                    );
                  }}
                />
              </PopoverContent>
            </Popover>
          )}
          {activeWorkflow === 'execution' && (
            <Popover placement="bottom" isOpen={showExecutionFilter} onOpenChange={(open) => setShowExecutionFilter(open)}>
              <Badge
                color="danger"
                content={activeExecutionFilterNum}
                isInvisible={activeExecutionFilterNum === 0}
                shape="circle"
                placement="top-left"
              >
                <PopoverTrigger>
                  <Button
                    startContent={<Filter size={16} />}
                    endContent={<ChevronDown size={16} />}
                    size="sm"
                    variant="bordered"
                    className="me-2"
                  >
                    {messages.filter}
                  </Button>
                </PopoverTrigger>
              </Badge>
              <PopoverContent>
                <ExecutionRunFilter
                  messages={messages}
                  activeSearchFilter={executionSearchFilter}
                  activeStatusFilters={executionStatusFilter}
                  activeTagFilters={executionTagFilter}
                  activePriorityFilters={executionPriorityFilter}
                  activeTypeFilters={executionTypeFilter}
                  projectId={projectId}
                  priorityMessages={priorityMessages}
                  testRunCaseStatusMessages={testRunCaseStatusMessages}
                  testTypeMessages={testTypeMessages}
                  onFilterChange={(newTitleFilter, newStatusFilters, newTagFilters, newPriorityFilters, newTypeFilters) => {
                    setShowExecutionFilter(false);
                    onExecutionFilterChange(
                      newTitleFilter,
                      newStatusFilters,
                      newTagFilters,
                      newPriorityFilters,
                      newTypeFilters
                    );
                  }}
                />
              </PopoverContent>
            </Popover>
          )}
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <Button
                variant="bordered"
                size="sm"
                className="me-2"
                startContent={<FileDown size={16} />}
                endContent={<ChevronDown size={16} />}
              >
                {messages.export}
              </Button>
            </DropdownTrigger>
            <DropdownMenu disallowEmptySelection aria-label="Export options">
              <DropdownItem
                key="xml"
                startContent={<FileCode size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'xml')}
              >
                xml
              </DropdownItem>
              <DropdownItem
                key="json"
                startContent={<FileJson size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'json')}
              >
                json
              </DropdownItem>
              <DropdownItem
                key="csv"
                startContent={<FileSpreadsheet size={16} />}
                onPress={() => exportRun(tokenContext.token.access_token, Number(testRun.id), 'csv')}
              >
                csv
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
          <Button
            startContent={
              <Badge isInvisible={!isActiveWorkflowDirty} color="danger" size="sm" content="" shape="circle">
                <Save size={16} />
              </Badge>
            }
            size="sm"
            isDisabled={isSaveDisabled}
            color="primary"
            isLoading={isUpdating}
            onPress={onSave}
          >
            {isUpdating ? messages.updating : saveLabel}
          </Button>
          {onDiscard && (
            <Button size="sm" variant="bordered" className="ms-2" onPress={onDiscard}>
              {messages.discard}
            </Button>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-5xl pt-6 px-6 flex-grow">
        <Tabs
          selectedKey={activeWorkflow}
          onSelectionChange={handleWorkflowChange}
          aria-label="Test Run workflows"
        >
          <Tab key="overview" id="overview" title={renderWorkflowTitle('overview')}>
            <div className="flex">
          <div>
            <div className="w-96 h-72">
              <div className="flex items-center">
                <h4 className="font-bold">{messages.progress}</h4>
                <Tooltip content={messages.refresh}>
                  <Button
                    isIconOnly
                    size="sm"
                    className="rounded-full bg-transparent ms-1"
                    aria-label={messages.refresh}
                    isDisabled={isOverviewDirty}
                    onPress={fetchRunAndStatusCount}
                  >
                    <RotateCw size={16} />
                  </Button>
                </Tooltip>
              </div>

              <RunProgressChart
                statusCounts={runStatusCounts}
                testRunCaseStatusMessages={testRunCaseStatusMessages}
                theme={theme}
              />
            </div>
          </div>
          <div className="flex-grow">
            <Input
              size="sm"
              type="text"
              variant="bordered"
              label={messages.title}
              value={testRun.name}
              isInvalid={isNameInvalid}
              errorMessage={isNameInvalid ? messages.pleaseEnter : ''}
                  onChange={(e) => {
                    setIsOverviewDirty(true);
                    setTestRun({ ...testRun, name: e.target.value });
                  }}
              className="mt-3"
            />

            <TextArea
              size="sm"
              variant="bordered"
              label={messages.description}
                  value={testRun.description}
                  onValueChange={(changeValue) => {
                    setIsOverviewDirty(true);
                    setTestRun({ ...testRun, description: changeValue });
                  }}
              className="mt-3"
            />

            <div>
              <Select
                size="sm"
                variant="bordered"
                selectedKeys={[testRunStatus[testRun.state].uid]}
                onSelectionChange={(newSelection) => {
                  if (newSelection !== 'all' && newSelection.size !== 0) {
                        const selectedUid = Array.from(newSelection)[0];
                        const index = testRunStatus.findIndex((template) => template.uid === selectedUid);
                        setIsOverviewDirty(true);
                        setTestRun({ ...testRun, state: index });
                      }
                }}
                label={messages.status}
                className="mt-3 max-w-xs"
              >
                {testRunStatus.map((status) => (
                  <SelectItem key={status.uid}>{runStatusMessages[status.uid]}</SelectItem>
                ))}
              </Select>
            </div>
          </div>
            </div>
          </Tab>

          <Tab key="selection" id="selection" title={renderWorkflowTitle('selection')}>
            <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h6 className="h-8 font-bold">{messages.selectTestCase}</h6>
            <Checkbox isSelected={includeSubfolders} onValueChange={handleIncludeSubfoldersChange}>
              {messages.includeSubfolders}
            </Checkbox>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-default-500">
                  {selectedCaseCount} {messages.selected}
                </span>
                <Button
                  size="sm"
                  isDisabled={!tokenContext.isProjectReporter(Number(projectId)) || !hasSelectedCaseRows}
                  color="primary"
                  startContent={<CopyPlus size={16} />}
                  onPress={() => handleBulkIncludeExcludeCases(true)}
                >
                  {messages.includeInRun}
                </Button>
                <Button
                  size="sm"
                  isDisabled={!tokenContext.isProjectReporter(Number(projectId)) || !hasSelectedCaseRows}
                  variant="bordered"
                  startContent={<CopyMinus size={16} />}
                  onPress={() => handleBulkIncludeExcludeCases(false)}
                >
                  {messages.excludeFromRun}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex rounded-small border-2 dark:border-neutral-700 mb-12">
          <div className="w-3/12 border-r-1 dark:border-neutral-700">
            <Tree
              data={treeData}
              className="w-full"
              indent={16}
              rowHeight={42}
              overscanCount={5}
              paddingTop={20}
              paddingBottom={20}
              padding={20}
              width="100%"
              openByDefault={false}
              disableDrop={true}
              disableDrag={true}
            >
              {({ node, style }: { node: NodeApi<TreeNodeData>; style: React.CSSProperties }) => {
                const caseCount = node.data.folderData.caseCount;
                const directCaseCount = node.data.folderData.directCaseCount;
                const hasChildren = Boolean(node.data.children && node.data.children.length > 0);
                const isOpenParent = hasChildren && node.isOpen;
                const FolderIcon = isOpenParent ? FolderOpen : Folder;
                const folderIconProps = isOpenParent
                  ? { color: '#E7B23D', fill: '#F7C24E', strokeWidth: 1.8 }
                  : { color: '#E7B23D', fill: '#F7C24E', strokeWidth: 1.8 };
                const directCountTitle =
                  typeof caseCount === 'number' && typeof directCaseCount === 'number' && directCaseCount < caseCount
                    ? `${directCaseCount} directly placed`
                    : undefined;

                return (
                  <TreeItem
                    style={style}
                    isSelected={selectedFolder ? node.data.id === selectedFolder.id : false}
                    onClick={async () => {
                      setSelectedKeys(new Set([]));
                      setSelectedFolder(node.data);
                      writeSelectionScopeToUrl(node.data);
                      await initTestCases(node.data, includeSubfolders);
                    }}
                    toggleButton={
                      hasChildren ? (
                        <Button
                          size="sm"
                          className="bg-transparent rounded-full h-6 w-6 min-w-4"
                          isIconOnly
                          onPress={() => node.toggle()}
                        >
                          {node.isOpen ? (
                            <ChevronDown size={20} color="#F7C24E" />
                          ) : (
                            <ChevronRight size={20} color="#F7C24E" />
                          )}
                        </Button>
                      ) : null
                    }
                    icon={<FolderIcon size={20} className="flex-shrink-0" {...folderIconProps} />}
                    label={node.data.name}
                    actions={
                      typeof caseCount === 'number' ? (
                        <span
                          className="mr-1 rounded-full bg-default-100 px-2 py-0.5 text-xs text-default-600"
                          title={directCountTitle}
                          aria-label={`Folder Scope Count ${caseCount}`}
                        >
                          {caseCount}
                        </span>
                      ) : undefined
                    }
                  />
                );
              }}
            </Tree>
          </div>
          <div className="w-9/12 overflow-x-auto">
                <TestCaseSelector
                  cases={filteredTestCases}
                  selectedKeys={selectedKeys}
                  onSelectionChange={setSelectedKeys}
                  messages={messages}
                  priorityMessages={priorityMessages}
                />
          </div>
            </div>
          </Tab>

          <Tab key="execution" id="execution" title={renderWorkflowTitle('execution')}>
            <div>
              {isSelectionDirty && (
                <div className="mb-3 rounded-small border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700 dark:border-warning-700 dark:bg-warning-950/30 dark:text-warning-200">
                  {messages.savedRunCasesOnly}
                </div>
              )}
              <div className="flex items-center gap-3">
                <h6 className="h-8 font-bold">{messages.runCaseExecution}</h6>
                <Checkbox isSelected={executionIncludeSubfolders} onValueChange={handleExecutionIncludeSubfoldersChange}>
                  {messages.includeSubfolders}
                </Checkbox>
              </div>
              <div className="mt-3 flex rounded-small border-2 dark:border-neutral-700 mb-12">
                <div className="w-3/12 border-r-1 dark:border-neutral-700">
                  <div className="px-5 pt-4">
                    <Button
                      size="sm"
                      variant={executionSelectedFolder ? 'light' : 'flat'}
                      className="w-full justify-start"
                      onPress={handleClearExecutionFolderScope}
                    >
                      {messages.all}
                    </Button>
                  </div>
                  <Tree
                    data={treeData}
                    className="w-full"
                    indent={16}
                    rowHeight={42}
                    overscanCount={5}
                    paddingTop={12}
                    paddingBottom={20}
                    padding={20}
                    width="100%"
                    openByDefault={false}
                    disableDrop={true}
                    disableDrag={true}
                  >
                    {({ node, style }: { node: NodeApi<TreeNodeData>; style: React.CSSProperties }) => {
                      const hasChildren = Boolean(node.data.children && node.data.children.length > 0);
                      const isOpenParent = hasChildren && node.isOpen;
                      const FolderIcon = isOpenParent ? FolderOpen : Folder;
                      const folderIconProps = isOpenParent
                        ? { color: '#E7B23D', fill: '#F7C24E', strokeWidth: 1.8 }
                        : { color: '#E7B23D', fill: '#F7C24E', strokeWidth: 1.8 };

                      return (
                        <TreeItem
                          style={style}
                          isSelected={executionSelectedFolder ? node.data.id === executionSelectedFolder.id : false}
                          onClick={() => handleExecutionFolderChange(node.data)}
                          toggleButton={
                            hasChildren ? (
                              <Button
                                size="sm"
                                className="bg-transparent rounded-full h-6 w-6 min-w-4"
                                isIconOnly
                                onPress={() => node.toggle()}
                              >
                                {node.isOpen ? (
                                  <ChevronDown size={20} color="#F7C24E" />
                                ) : (
                                  <ChevronRight size={20} color="#F7C24E" />
                                )}
                              </Button>
                            ) : null
                          }
                          icon={<FolderIcon size={20} className="flex-shrink-0" {...folderIconProps} />}
                          label={node.data.name}
                        />
                      );
                    }}
                  </Tree>
                </div>
                <div className="w-9/12 overflow-x-auto">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-3xl text-sm">
                      <thead>
                        <tr className="border-b border-divider text-left text-default-500">
                          <th className="px-3 py-2 font-medium">{messages.id}</th>
                          <th className="px-3 py-2 font-medium">{messages.title}</th>
                          <th className="px-3 py-2 font-medium">{messages.folderPath}</th>
                          <th className="px-3 py-2 font-medium">{messages.status}</th>
                          <th className="px-3 py-2 font-medium">{messages.tags}</th>
                          <th className="px-3 py-2 font-medium">{messages.comments}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {executionRunCases.length === 0 ? (
                          <tr>
                            <td className="px-3 py-6 text-center text-default-500" colSpan={6}>
                              {messages.noCasesFound}
                            </td>
                          </tr>
                        ) : (
                          executionRunCases.map((runCase) => {
                            const testCase = runCase.Case;
                            return (
                              <tr key={runCase.id} className="border-b border-divider last:border-b-0">
                                <td className="px-3 py-2">{runCase.caseId}</td>
                                <td className="px-3 py-2">
                                  <a
                                    className="text-primary hover:underline"
                                    href={`/${locale}/projects/${projectId}/runs/${runId}/cases/${runCase.caseId}?${executionDetailQuery()}`}
                                  >
                                    {testCase?.title || runCase.caseId}
                                  </a>
                                </td>
                                <td className="px-3 py-2">{testCase?.folderPath?.join(' / ') || '-'}</td>
                                <td className="px-3 py-2">
                                  <select
                                    aria-label={`${messages.status} ${runCase.caseId}`}
                                    className="rounded-small border border-default-200 bg-transparent px-2 py-1"
                                    value={String(runCase.status)}
                                    onChange={(event) => handleRunCaseStatusChange(runCase, Number(event.target.value))}
                                  >
                                    {testRunCaseStatus.map((status, index) => (
                                      <option key={status.uid} value={index}>
                                        {testRunCaseStatusMessages[status.uid] || status.uid}
                                      </option>
                                    ))}
                                  </select>
                                  {runCase.editState === 'changed' && (
                                    <span className="ms-2 inline-block h-2 w-2 rounded-full bg-danger" />
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {testCase?.Tags && testCase.Tags.length > 0
                                    ? testCase.Tags.map((tag) => tag.name).join(', ')
                                    : '-'}
                                </td>
                                <td className="px-3 py-2">{runCase.commentCount || 0}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Tab>
        </Tabs>
      </div>
    </>
  );
}
