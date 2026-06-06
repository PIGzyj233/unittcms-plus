import { useEffect, useState } from 'react';
import { Check, ExternalLink, Save, X } from 'lucide-react';
import { Button, Checkbox, Chip, Input, TextArea } from '@/components/heroui';
import { Link, NextUiLinkClasses } from '@/src/i18n/routing';
import { AgentCandidate, AgentCandidateMessages } from '@/types/agentCandidate';
import { formatAgentCandidateSource } from '@/utils/agentCandidateSource';

export type CandidateCaseMessages = {
  description: string;
  preconditions: string;
  expectedResult: string;
  steps: string;
  tags: string;
  update: string;
};

type CandidateForm = {
  title: string;
  description: string;
  preConditions: string;
  expectedResults: string;
  rationale: string;
  stepsText: string;
  tagIdsText: string;
  suggestedTagsText: string;
};

type Props = {
  projectId: string;
  locale: string;
  candidate: AgentCandidate | null;
  isDisabled: boolean;
  messages: AgentCandidateMessages;
  caseMessages: CandidateCaseMessages;
  onSaveCandidate: (candidate: AgentCandidate) => void;
  onAcceptCandidate: (candidateId: number, createMissingTags: boolean) => void;
  onRejectCandidate: (candidateId: number) => void;
};

const emptyForm: CandidateForm = {
  title: '',
  description: '',
  preConditions: '',
  expectedResults: '',
  rationale: '',
  stepsText: '[]',
  tagIdsText: '',
  suggestedTagsText: '',
};

function formFromCandidate(candidate: AgentCandidate): CandidateForm {
  return {
    title: candidate.title,
    description: candidate.description,
    preConditions: candidate.preConditions,
    expectedResults: candidate.expectedResults,
    rationale: candidate.rationale,
    stepsText: JSON.stringify(candidate.steps, null, 2),
    tagIdsText: candidate.tagIds.join(', '),
    suggestedTagsText: candidate.suggestedTags.join(', '),
  };
}

function parseNumberList(value: string) {
  if (value.trim() === '') {
    return [];
  }

  return value.split(',').map((item) => Number(item.trim()));
}

function parseStringList(value: string) {
  if (value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isCandidateStep(value: unknown): value is { step: string; result: string } {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { step?: unknown }).step === 'string' &&
    typeof (value as { result?: unknown }).result === 'string'
  );
}

export default function CandidateDetail({
  projectId,
  locale,
  candidate,
  isDisabled,
  messages,
  caseMessages,
  onSaveCandidate,
  onAcceptCandidate,
  onRejectCandidate,
}: Props) {
  const [form, setForm] = useState<CandidateForm>(emptyForm);
  const [createMissingTags, setCreateMissingTags] = useState(false);
  const [stepsError, setStepsError] = useState('');
  const [tagIdsError, setTagIdsError] = useState('');

  useEffect(() => {
    setForm(candidate ? formFromCandidate(candidate) : emptyForm);
    setCreateMissingTags(false);
    setStepsError('');
    setTagIdsError('');
  }, [candidate]);

  if (!candidate) {
    return <div className="border border-divider p-4 text-sm text-neutral-500">{messages.noCandidatesFound}</div>;
  }

  const isDraft = candidate.status === 'draft';
  const formDisabled = isDisabled || !isDraft;
  const warnings = candidate.duplicateMetadata.warnings;

  const handleSave = () => {
    let parsedSteps: unknown;
    try {
      parsedSteps = JSON.parse(form.stepsText);
    } catch {
      setStepsError('JSON');
      return;
    }

    if (!Array.isArray(parsedSteps) || !parsedSteps.every(isCandidateStep)) {
      setStepsError('JSON');
      return;
    }

    const parsedTagIds = parseNumberList(form.tagIdsText);
    if (parsedTagIds.some((tagId) => !Number.isSafeInteger(tagId) || tagId <= 0)) {
      setTagIdsError('ID');
      return;
    }

    setStepsError('');
    setTagIdsError('');
    onSaveCandidate({
      ...candidate,
      title: form.title,
      description: form.description,
      preConditions: form.preConditions,
      expectedResults: form.expectedResults,
      rationale: form.rationale,
      steps: parsedSteps,
      tagIds: parsedTagIds,
      suggestedTags: parseStringList(form.suggestedTagsText),
    });
  };

  return (
    <div className="border border-divider p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="truncate font-bold">{candidate.title}</h4>
            <Chip size="sm">{messages[candidate.status]}</Chip>
          </div>
          <div className="mt-1 text-xs text-neutral-500">#{candidate.id}</div>
        </div>
        {candidate.acceptedCaseId && (
          <Link
            href={`/projects/${projectId}/folders/${candidate.folderId}/cases/${candidate.acceptedCaseId}`}
            locale={locale}
            className={`${NextUiLinkClasses} inline-flex items-center gap-1 text-sm`}
          >
            {messages.acceptedCase}
            <ExternalLink size={14} />
          </Link>
        )}
      </div>

      <div className="grid gap-3">
        <Input
          label={messages.title}
          value={form.title}
          isDisabled={formDisabled}
          onValueChange={(title) => setForm((current) => ({ ...current, title }))}
        />
        <TextArea
          label={caseMessages.description}
          value={form.description}
          isDisabled={formDisabled}
          minRows={3}
          onValueChange={(description) => setForm((current) => ({ ...current, description }))}
        />
        <TextArea
          label={caseMessages.preconditions}
          value={form.preConditions}
          isDisabled={formDisabled}
          minRows={3}
          onValueChange={(preConditions) => setForm((current) => ({ ...current, preConditions }))}
        />
        <TextArea
          label={caseMessages.expectedResult}
          value={form.expectedResults}
          isDisabled={formDisabled}
          minRows={3}
          onValueChange={(expectedResults) => setForm((current) => ({ ...current, expectedResults }))}
        />
        <TextArea
          label={messages.rationale}
          value={form.rationale}
          isDisabled={formDisabled}
          minRows={3}
          onValueChange={(rationale) => setForm((current) => ({ ...current, rationale }))}
        />
        <TextArea
          label={caseMessages.steps}
          value={form.stepsText}
          isDisabled={formDisabled}
          isInvalid={Boolean(stepsError)}
          errorMessage={stepsError}
          minRows={6}
          onValueChange={(stepsText) => setForm((current) => ({ ...current, stepsText }))}
        />
        <Input
          label={caseMessages.tags}
          value={form.tagIdsText}
          isDisabled={formDisabled}
          isInvalid={Boolean(tagIdsError)}
          errorMessage={tagIdsError}
          onValueChange={(tagIdsText) => setForm((current) => ({ ...current, tagIdsText }))}
        />
        <Input
          label={messages.suggestedTags}
          value={form.suggestedTagsText}
          isDisabled={formDisabled}
          onValueChange={(suggestedTagsText) => setForm((current) => ({ ...current, suggestedTagsText }))}
        />
        <Input label={messages.source} value={formatAgentCandidateSource(candidate.source, messages)} isReadOnly />

        <div>
          <div className="mb-2 text-sm text-foreground">{messages.duplicateWarnings}</div>
          {warnings.length > 0 ? (
            <div className="space-y-2">
              {warnings.map((warning, index) => (
                <div key={`${warning.strength}-${index}`} className="border border-divider p-2 text-sm">
                  <div className="font-medium">{warning.strength}</div>
                  <div>{warning.message}</div>
                  <div className="text-xs text-neutral-500">{warning.ids.join(', ')}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-neutral-500">0</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-divider pt-4">
        <Checkbox isSelected={createMissingTags} isDisabled={formDisabled} onValueChange={setCreateMissingTags}>
          {messages.createMissingTags}
        </Checkbox>
        <div className="flex items-center gap-2">
          <Button
            startContent={<Save size={16} />}
            size="sm"
            variant="bordered"
            isDisabled={formDisabled}
            onPress={handleSave}
          >
            {caseMessages.update}
          </Button>
          <Button
            startContent={<X size={16} />}
            size="sm"
            color="danger"
            isDisabled={formDisabled}
            onPress={() => onRejectCandidate(candidate.id)}
          >
            {messages.reject}
          </Button>
          <Button
            startContent={<Check size={16} />}
            size="sm"
            color="primary"
            isDisabled={formDisabled}
            onPress={() => onAcceptCandidate(candidate.id, createMissingTags)}
          >
            {messages.accept}
          </Button>
        </div>
      </div>
    </div>
  );
}
