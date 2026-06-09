import { afterEach, describe, expect, test, assert, vi } from 'vitest';
import { changeStatus, fetchProjectCases, fetchRunCases, includeExcludeTestCases } from './runsControl';
import { CaseType } from '@/types/case';

const sampleTestCase: CaseType = {
  id: 1,
  title: '',
  state: 0,
  priority: 0,
  type: 0,
  automationStatus: 0,
  description: '',
  template: 0,
  preConditions: '',
  expectedResults: '',
  folderId: 1,
};

const initialTestCases: CaseType[] = [
  {
    ...sampleTestCase,
    id: 1,
    RunCases: [
      {
        id: 1,
        runId: 1,
        caseId: 1,
        status: 0,
        editState: 'notChanged',
      },
    ],
  },
  {
    ...sampleTestCase,
    id: 2,
    RunCases: [
      {
        id: 2,
        runId: 1,
        caseId: 2,
        status: 0,
        editState: 'notChanged',
      },
    ],
  },
  {
    ...sampleTestCase,
    id: 3,
    RunCases: [
      {
        id: 3,
        runId: 1,
        caseId: 3,
        status: 0,
        editState: 'new',
      },
    ],
  },
  {
    ...sampleTestCase,
    id: 4,
    RunCases: [
      {
        id: 4,
        runId: 1,
        caseId: 4,
        status: 0,
        editState: 'deleted',
      },
    ],
  },
];

describe('runsControl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('fetches Test Run case selection from the selected Folder Scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchProjectCases('token', 1, 2, 7, false, 'login & checkout=1', ['1'], ['3']);

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toMatch(/\/cases\/byproject$/);
    expect(url.searchParams.get('projectId')).toBe('1');
    expect(url.searchParams.get('runId')).toBe('2');
    expect(url.searchParams.get('folderId')).toBe('7');
    expect(url.searchParams.get('includeSubfolders')).toBe('false');
    expect(url.searchParams.get('search')).toBe('login & checkout=1');
    expect(url.searchParams.get('status')).toBe('1');
    expect(url.searchParams.get('tag')).toBe('3');
  });

  test('fetches Test Run case selection with priority and type filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchProjectCases('token', 1, 2, 7, true, undefined, undefined, undefined, ['1', '2'], ['4']);

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.searchParams.get('priority')).toBe('1,2');
    expect(url.searchParams.get('type')).toBe('4');
    expect(url.searchParams.get('status')).toBeNull();
  });

  test('fetches saved Run Cases with execution filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await fetchRunCases('token', 2, {
      search: 'checkout',
      status: ['1'],
      tag: ['3'],
      priority: ['2'],
      type: ['4'],
      folderId: 7,
      includeSubfolders: false,
    });

    const url = new URL(fetchMock.mock.calls[0][0] as string, 'http://localhost');
    expect(url.pathname).toMatch(/\/runcases$/);
    expect(url.searchParams.get('runId')).toBe('2');
    expect(url.searchParams.get('search')).toBe('checkout');
    expect(url.searchParams.get('status')).toBe('1');
    expect(url.searchParams.get('tag')).toBe('3');
    expect(url.searchParams.get('priority')).toBe('2');
    expect(url.searchParams.get('type')).toBe('4');
    expect(url.searchParams.get('folderId')).toBe('7');
    expect(url.searchParams.get('includeSubfolders')).toBe('false');
  });

  test('update test case which has not changed yet', () => {
    const changeCaseId = 1;
    const newStatus = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = changeStatus(changeCaseId, newStatus, currentRunCases);

    if (newTestCases[0] && newTestCases[0].RunCases && newTestCases[0].RunCases[0]) {
      expect(newTestCases[0].RunCases[0].status).toBe(1);
      expect(newTestCases[0].RunCases[0].editState).toBe('changed');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test('update test case which has already changed', () => {
    const changeCaseId = 1;
    const newStatus = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = changeStatus(changeCaseId, newStatus, currentRunCases);

    const overwriteStatus = 2;
    const overwrittenCases = changeStatus(changeCaseId, overwriteStatus, newTestCases);

    if (overwrittenCases[0] && overwrittenCases[0].RunCases && overwrittenCases[0].RunCases[0]) {
      expect(overwrittenCases[0].RunCases[0].status).toBe(2);
      expect(overwrittenCases[0].RunCases[0].editState).toBe('changed');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test('when update test case whose editState is "new", the editState remains "new"', () => {
    const changeCaseId = 3;
    const newStatus = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = changeStatus(changeCaseId, newStatus, currentRunCases);

    if (newTestCases[2] && newTestCases[2].RunCases && newTestCases[2].RunCases[0]) {
      expect(newTestCases[2].RunCases[0].status).toBe(1);
      expect(newTestCases[2].RunCases[0].editState).toBe('new');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test('when update test case whose editState is "deleted", the editState remains "deleted" and status not changed', () => {
    const changeCaseId = 4;
    const newStatus = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = changeStatus(changeCaseId, newStatus, currentRunCases);

    if (newTestCases[3] && newTestCases[3].RunCases && newTestCases[3].RunCases[0]) {
      expect(newTestCases[3].RunCases[0].status).toBe(0);
      expect(newTestCases[3].RunCases[0].editState).toBe('deleted');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test("included test case's editState is 'new'", () => {
    const isInclude = true;
    const keys: number[] = [3];
    const runId = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = includeExcludeTestCases(isInclude, keys, runId, currentRunCases);

    if (newTestCases[2] && newTestCases[2].RunCases && newTestCases[2].RunCases[0]) {
      expect(newTestCases[2].RunCases[0].editState).toBe('new');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test('when include test case, whose editState is "new"', () => {
    const isInclude = true;
    const keys: number[] = [3];
    const runId = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = includeExcludeTestCases(isInclude, keys, runId, currentRunCases);

    if (newTestCases[2] && newTestCases[2].RunCases && newTestCases[2].RunCases[0]) {
      expect(newTestCases[2].RunCases[0].editState).toBe('new');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test("excluded test cases's editState are 'deleted'", () => {
    const isInclude = false;
    const keys: number[] = [1, 3];
    const runId = 1;
    const currentRunCases = [...initialTestCases];
    const newTestCases = includeExcludeTestCases(isInclude, keys, runId, currentRunCases);

    if (newTestCases[0] && newTestCases[0].RunCases && newTestCases[0].RunCases[0]) {
      expect(newTestCases[0].RunCases[0].editState).toBe('deleted');
    } else {
      assert.fail("RunCases isn't exist");
    }

    if (newTestCases[2] && newTestCases[2].RunCases && newTestCases[2].RunCases[0]) {
      expect(newTestCases[2].RunCases[0].editState).toBe('deleted');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test('including an excluded saved test case cancels the Membership draft', () => {
    const runId = 1;
    const excludedTestCases = includeExcludeTestCases(false, [1], runId, structuredClone(initialTestCases));
    const restoredTestCases = includeExcludeTestCases(true, [1], runId, excludedTestCases);

    if (restoredTestCases[0] && restoredTestCases[0].RunCases && restoredTestCases[0].RunCases[0]) {
      expect(restoredTestCases[0].RunCases[0].editState).toBe('notChanged');
    } else {
      assert.fail("RunCases isn't exist");
    }
  });

  test('excluding a newly included test case cancels the Membership draft', () => {
    const runId = 1;
    const candidateTestCases: CaseType[] = [{ ...sampleTestCase, id: 5, RunCases: [] }];
    const includedTestCases = includeExcludeTestCases(true, [5], runId, candidateTestCases);
    const restoredTestCases = includeExcludeTestCases(false, [5], runId, includedTestCases);

    expect(restoredTestCases[0]?.RunCases || []).toHaveLength(0);
  });
});
