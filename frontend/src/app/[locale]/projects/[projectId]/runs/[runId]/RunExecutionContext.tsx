'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { CaseType } from '@/types/case';
import type { RunCaseType } from '@/types/run';
import { TokenContext } from '@/utils/TokenProvider';

type EditableRunCase = NonNullable<CaseType['RunCases']>[number];

type RunExecutionContextValue = {
  executionRunCases: RunCaseType[];
  savedExecutionRunCases: RunCaseType[];
  runCaseStatusEditsByRunCaseId: Map<number, EditableRunCase>;
  isExecutionDirty: boolean;
  handleRunCaseStatusChange: (runCase: RunCaseType, nextStatus: number) => void;
  getExecutionRunCase: (caseId: number) => RunCaseType | undefined;
  syncExecutionRunCases: (savedRunCases: RunCaseType[], statusEdits?: Map<number, EditableRunCase>) => void;
  setRunCaseStatusEditsByRunCaseId: React.Dispatch<React.SetStateAction<Map<number, EditableRunCase>>>;
  discardExecutionEdits: () => void;
  canEditExecution: boolean;
};

const RunExecutionContext = createContext<RunExecutionContextValue | null>(null);

export function applyRunCaseStatusEdits(runCases: RunCaseType[], edits: Map<number, EditableRunCase>) {
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
}

export function RunExecutionProvider({ children }: { children: React.ReactNode }) {
  const tokenContext = useContext(TokenContext);
  const [executionRunCases, setExecutionRunCases] = useState<RunCaseType[]>([]);
  const [savedExecutionRunCases, setSavedExecutionRunCases] = useState<RunCaseType[]>([]);
  const [runCaseStatusEditsByRunCaseId, setRunCaseStatusEditsByRunCaseId] = useState<Map<number, EditableRunCase>>(
    new Map()
  );

  const isExecutionDirty = runCaseStatusEditsByRunCaseId.size > 0;
  const canEditExecution = tokenContext.isSignedIn();

  const syncExecutionRunCases = useCallback(
    (savedRunCases: RunCaseType[], statusEdits = runCaseStatusEditsByRunCaseId) => {
      const normalizedSavedRunCases = savedRunCases.map((runCase) => ({
        ...runCase,
        editState: 'notChanged' as const,
      }));
      setSavedExecutionRunCases(normalizedSavedRunCases);
      setExecutionRunCases(applyRunCaseStatusEdits(normalizedSavedRunCases, statusEdits));
    },
    [runCaseStatusEditsByRunCaseId]
  );

  const handleRunCaseStatusChange = useCallback(
    (runCase: RunCaseType, nextStatus: number) => {
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
    },
    [savedExecutionRunCases]
  );

  const getExecutionRunCase = useCallback(
    (caseId: number) => executionRunCases.find((runCase) => runCase.caseId === caseId),
    [executionRunCases]
  );

  const discardExecutionEdits = useCallback(() => {
    setRunCaseStatusEditsByRunCaseId(new Map());
    setExecutionRunCases(savedExecutionRunCases);
  }, [savedExecutionRunCases]);

  const value = useMemo(
    () => ({
      executionRunCases,
      savedExecutionRunCases,
      runCaseStatusEditsByRunCaseId,
      isExecutionDirty,
      handleRunCaseStatusChange,
      getExecutionRunCase,
      syncExecutionRunCases,
      setRunCaseStatusEditsByRunCaseId,
      discardExecutionEdits,
      canEditExecution,
    }),
    [
      executionRunCases,
      savedExecutionRunCases,
      runCaseStatusEditsByRunCaseId,
      isExecutionDirty,
      handleRunCaseStatusChange,
      getExecutionRunCase,
      syncExecutionRunCases,
      discardExecutionEdits,
      canEditExecution,
    ]
  );

  return <RunExecutionContext.Provider value={value}>{children}</RunExecutionContext.Provider>;
}

export function useRunExecution() {
  const context = useContext(RunExecutionContext);
  if (!context) {
    throw new Error('useRunExecution must be used within RunExecutionProvider');
  }
  return context;
}
