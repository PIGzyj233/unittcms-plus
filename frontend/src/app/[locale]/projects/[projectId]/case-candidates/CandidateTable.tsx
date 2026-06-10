import { Check, ExternalLink, X } from 'lucide-react';
import { Button, Checkbox, Chip, Tooltip } from '@/components/heroui';
import { Link, NextUiLinkClasses } from '@/src/i18n/routing';
import { AgentCandidate, AgentCandidateMessages } from '@/types/agentCandidate';
import { formatAgentCandidateSource } from '@/utils/agentCandidateSource';

export type CandidateCasesMessages = {
  id: string;
  actions: string;
};

type Props = {
  projectId: string;
  locale: string;
  candidates: AgentCandidate[];
  selectedIds: Set<number>;
  selectedCandidateId: number | null;
  isDisabled: boolean;
  messages: AgentCandidateMessages;
  casesMessages: CandidateCasesMessages;
  onSelectCandidate: (candidateId: number) => void;
  onSelectedIdsChange: (selectedIds: Set<number>) => void;
  onAcceptCandidate: (candidateId: number) => void;
  onRejectCandidate: (candidateId: number) => void;
};

function statusLabel(messages: AgentCandidateMessages, status: AgentCandidate['status']) {
  return messages[status];
}

export default function CandidateTable({
  projectId,
  locale,
  candidates,
  selectedIds,
  selectedCandidateId,
  isDisabled,
  messages,
  casesMessages,
  onSelectCandidate,
  onSelectedIdsChange,
  onAcceptCandidate,
  onRejectCandidate,
}: Props) {
  const draftCandidates = candidates.filter((candidate) => candidate.status === 'draft');
  const isAllSelected =
    draftCandidates.length > 0 && draftCandidates.every((candidate) => selectedIds.has(candidate.id));

  const handleSelectAll = () => {
    if (isDisabled) {
      return;
    }

    if (isAllSelected) {
      onSelectedIdsChange(new Set());
      return;
    }
    onSelectedIdsChange(new Set(draftCandidates.map((candidate) => candidate.id)));
  };

  const handleSelectRow = (candidateId: number) => {
    if (isDisabled) {
      return;
    }

    const nextSelectedIds = new Set(selectedIds);
    if (nextSelectedIds.has(candidateId)) {
      nextSelectedIds.delete(candidateId);
    } else {
      nextSelectedIds.add(candidateId);
    }
    onSelectedIdsChange(nextSelectedIds);
  };

  return (
    <>
      <table className="workspace-native-table min-w-[900px]">
        <thead>
          <tr className="border-b border-separator">
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              <Checkbox
                isSelected={isAllSelected}
                onChange={handleSelectAll}
                isDisabled={isDisabled || draftCandidates.length === 0}
              />
            </th>
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              {casesMessages.id}
            </th>
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              {messages.title}
            </th>
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              {messages.status}
            </th>
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              {messages.duplicateWarnings}
            </th>
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              {messages.source}
            </th>
            <th className="border-b border-divider px-3 py-2 text-left font-medium text-default-500">
              {casesMessages.actions}
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((candidate) => {
            const isDraft = candidate.status === 'draft';
            const isCurrent = selectedCandidateId === candidate.id;
            return (
              <tr
                key={candidate.id}
                className={[
                  'cursor-pointer border-b border-separator hover:bg-default-100',
                  isCurrent ? 'bg-default-100' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onSelectCandidate(candidate.id)}
              >
                <td className="border-b border-separator px-3 py-2">
                  <Checkbox
                    isSelected={selectedIds.has(candidate.id)}
                    isDisabled={isDisabled || !isDraft}
                    onChange={() => handleSelectRow(candidate.id)}
                  />
                </td>
                <td className="border-b border-separator px-3 py-2">{candidate.id}</td>
                <td className="border-b border-separator px-3 py-2">
                  <div className="max-w-sm truncate font-medium">{candidate.title}</div>
                  {candidate.acceptedCaseId && (
                    <Link
                      href={`/projects/${projectId}/folders/${candidate.folderId}/cases/${candidate.acceptedCaseId}`}
                      locale={locale}
                      className={`${NextUiLinkClasses} mt-1 inline-flex items-center gap-1 text-xs`}
                    >
                      {messages.acceptedCase}
                      <ExternalLink size={12} />
                    </Link>
                  )}
                </td>
                <td className="border-b border-separator px-3 py-2">
                  <Chip size="sm">{statusLabel(messages, candidate.status)}</Chip>
                </td>
                <td className="border-b border-separator px-3 py-2">{candidate.duplicateMetadata.warnings.length}</td>
                <td className="border-b border-separator px-3 py-2">
                  <div className="max-w-40 truncate">{formatAgentCandidateSource(candidate.source, messages)}</div>
                </td>
                <td className="border-b border-separator px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Tooltip content={messages.accept} placement="top">
                      <Button
                        isIconOnly
                        size="sm"
                        color="primary"
                        isDisabled={isDisabled || !isDraft}
                        onPress={() => onAcceptCandidate(candidate.id)}
                      >
                        <Check size={14} />
                      </Button>
                    </Tooltip>
                    <Tooltip content={messages.reject} placement="top">
                      <Button
                        isIconOnly
                        size="sm"
                        color="danger"
                        isDisabled={isDisabled || !isDraft}
                        onPress={() => onRejectCandidate(candidate.id)}
                      >
                        <X size={14} />
                      </Button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {candidates.length === 0 && (
        <div className="flex h-48 items-center justify-center text-sm text-neutral-500">
          {messages.noCandidatesFound}
        </div>
      )}
    </>
  );
}
