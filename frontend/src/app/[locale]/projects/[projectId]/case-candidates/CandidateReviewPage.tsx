'use client';

import { Key, useCallback, useContext, useEffect, useState } from 'react';
import CandidateBulkActions from './CandidateBulkActions';
import CandidateDetail, { CandidateCaseMessages } from './CandidateDetail';
import CandidateTable, { CandidateCasesMessages } from './CandidateTable';
import {
  acceptAgentCandidates,
  fetchAgentCandidates,
  rejectAgentCandidate,
  updateAgentCandidate,
} from '@/utils/agentCandidateControl';
import { addToast, Spinner, Tab, Tabs } from '@/components/heroui';
import { AgentCandidate, AgentCandidateMessages, AgentCandidateStatus } from '@/types/agentCandidate';
import { TokenContext } from '@/utils/TokenProvider';
import { logError } from '@/utils/errorHandler';

type Props = {
  projectId: string;
  locale: string;
  messages: AgentCandidateMessages;
  caseMessages: CandidateCaseMessages;
  casesMessages: CandidateCasesMessages;
};

const candidateStatuses: AgentCandidateStatus[] = ['draft', 'accepted', 'rejected', 'superseded'];

function statusMessage(messages: AgentCandidateMessages, status: AgentCandidateStatus) {
  return messages[status];
}

export default function CandidateReviewPage({ projectId, locale, messages, caseMessages, casesMessages }: Props) {
  const context = useContext(TokenContext);
  const numericProjectId = Number(projectId);
  const isEditable = context.isProjectDeveloper(numericProjectId);
  const [status, setStatus] = useState<AgentCandidateStatus>('draft');
  const [candidates, setCandidates] = useState<AgentCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const selectedCandidate = selectedCandidateId
    ? candidates.find((candidate) => candidate.id === selectedCandidateId) || null
    : candidates[0] || null;

  const loadCandidates = useCallback(async () => {
    if (!context.isSignedIn()) {
      setCandidates([]);
      setSelectedIds(new Set());
      setSelectedCandidateId(null);
      return;
    }

    setIsLoading(true);
    try {
      const data = await fetchAgentCandidates(context.token.access_token, numericProjectId, status);
      setCandidates(data);
      setSelectedIds(new Set());
      setSelectedCandidateId((currentId) => {
        if (currentId && data.some((candidate) => candidate.id === currentId)) {
          return currentId;
        }
        return data[0]?.id || null;
      });
    } catch (error: unknown) {
      setCandidates([]);
      setSelectedIds(new Set());
      setSelectedCandidateId(null);
      logError('Error fetching agent candidates', error);
      addToast({ title: 'Error', color: 'danger', description: messages.noCandidatesFound });
    } finally {
      setIsLoading(false);
    }
  }, [context, messages.noCandidatesFound, numericProjectId, status]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const handleStatusChange = (key: Key) => {
    setStatus(key as AgentCandidateStatus);
    setCandidates([]);
    setSelectedCandidateId(null);
    setSelectedIds(new Set());
  };

  const handleSaveCandidate = async (candidate: AgentCandidate) => {
    setIsMutating(true);
    try {
      const response = await updateAgentCandidate(context.token.access_token, numericProjectId, candidate);
      const updatedCandidate = response.candidate || candidate;
      setCandidates((current) =>
        current.map((currentCandidate) =>
          currentCandidate.id === updatedCandidate.id ? updatedCandidate : currentCandidate
        )
      );
      addToast({ title: 'Success', color: 'success', description: caseMessages.update });
    } catch (error: unknown) {
      logError('Error updating agent candidate', error);
      addToast({ title: 'Error', color: 'danger', description: caseMessages.update });
    } finally {
      setIsMutating(false);
    }
  };

  const handleRejectCandidate = async (candidateId: number) => {
    setIsMutating(true);
    try {
      await rejectAgentCandidate(context.token.access_token, numericProjectId, candidateId);
      await loadCandidates();
    } catch (error: unknown) {
      logError('Error rejecting agent candidate', error);
      addToast({ title: 'Error', color: 'danger', description: messages.reject });
    } finally {
      setIsMutating(false);
    }
  };

  const handleAcceptCandidates = async ({
    candidateIds,
    createMissingTags,
    allowPartial,
  }: {
    candidateIds: number[];
    createMissingTags: boolean;
    allowPartial: boolean;
  }) => {
    if (candidateIds.length === 0) {
      return;
    }

    setIsMutating(true);
    try {
      await acceptAgentCandidates({
        jwt: context.token.access_token,
        projectId: numericProjectId,
        candidateIds,
        createMissingTags,
        allowPartial,
      });
      await loadCandidates();
    } catch (error: unknown) {
      logError('Error accepting agent candidates', error);
      addToast({ title: 'Error', color: 'danger', description: messages.accept });
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">{messages.title}</h3>
        <CandidateBulkActions
          selectedCount={selectedIds.size}
          isDisabled={!isEditable || isMutating}
          messages={messages}
          onBulkAccept={(allowPartial) =>
            handleAcceptCandidates({
              candidateIds: Array.from(selectedIds),
              createMissingTags: false,
              allowPartial,
            })
          }
        />
      </div>

      <Tabs selectedKey={status} onSelectionChange={handleStatusChange}>
        {candidateStatuses.map((candidateStatus) => (
          <Tab key={candidateStatus} title={statusMessage(messages, candidateStatus)}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
              <div className="min-w-0 overflow-x-auto border border-divider">
                {isLoading ? (
                  <div className="flex h-48 items-center justify-center">
                    <Spinner />
                  </div>
                ) : (
                  <CandidateTable
                    projectId={projectId}
                    locale={locale}
                    candidates={candidates}
                    selectedIds={selectedIds}
                    selectedCandidateId={selectedCandidate?.id || null}
                    isDisabled={!isEditable || isMutating}
                    messages={messages}
                    casesMessages={casesMessages}
                    onSelectCandidate={setSelectedCandidateId}
                    onSelectedIdsChange={setSelectedIds}
                    onAcceptCandidate={(candidateId) =>
                      handleAcceptCandidates({
                        candidateIds: [candidateId],
                        createMissingTags: false,
                        allowPartial: false,
                      })
                    }
                    onRejectCandidate={handleRejectCandidate}
                  />
                )}
              </div>

              <CandidateDetail
                projectId={projectId}
                locale={locale}
                candidate={selectedCandidate}
                isDisabled={!isEditable || isMutating}
                messages={messages}
                caseMessages={caseMessages}
                onSaveCandidate={handleSaveCandidate}
                onAcceptCandidate={(candidateId, createMissingTags) =>
                  handleAcceptCandidates({
                    candidateIds: [candidateId],
                    createMissingTags,
                    allowPartial: false,
                  })
                }
                onRejectCandidate={handleRejectCandidate}
              />
            </div>
          </Tab>
        ))}
      </Tabs>
    </div>
  );
}
