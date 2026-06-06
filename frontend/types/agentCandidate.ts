export type AgentCandidateStatus = 'draft' | 'accepted' | 'rejected' | 'superseded';

export type AgentCandidate = {
  id: number;
  projectId: number;
  folderId: number;
  title: string;
  description: string;
  preConditions: string;
  expectedResults: string;
  priority: number;
  type: number;
  automationStatus: number;
  template: number;
  steps: { step: string; result: string }[];
  tagIds: number[];
  suggestedTags: string[];
  source: string;
  rationale: string;
  duplicateMetadata: { blocked: boolean; warnings: { strength: string; message: string; ids: number[] }[] };
  status: AgentCandidateStatus;
  acceptedCaseId: number | null;
};

export type AgentCandidateMessages = {
  title: string;
  status: string;
  draft: string;
  accepted: string;
  rejected: string;
  superseded: string;
  source: string;
  automatedSuggestion: string;
  rationale: string;
  duplicateWarnings: string;
  accept: string;
  reject: string;
  bulkAccept: string;
  allowPartial: string;
  suggestedTags: string;
  createMissingTags: string;
  acceptedCase: string;
  noCandidatesFound: string;
};

export type AgentCandidateAcceptResult = {
  accepted: { candidateId: number; caseId: number }[];
  failed: { candidateId: number; error: string }[];
};
