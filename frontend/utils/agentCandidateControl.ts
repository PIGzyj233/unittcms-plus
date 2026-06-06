import Config from '@/config/config';
import { AgentCandidate, AgentCandidateAcceptResult } from '@/types/agentCandidate';

const apiServer = Config.apiServer;

type AgentCandidateUpdatePayload = Pick<
  AgentCandidate,
  'title' | 'description' | 'preConditions' | 'expectedResults' | 'steps' | 'tagIds' | 'suggestedTags' | 'rationale'
>;

type DryRunResponse = {
  dryRun: {
    operationToken: string;
  };
};

function buildAgentCandidateUpdatePayload(candidate: AgentCandidate): AgentCandidateUpdatePayload {
  return {
    title: candidate.title,
    description: candidate.description,
    preConditions: candidate.preConditions,
    expectedResults: candidate.expectedResults,
    steps: candidate.steps,
    tagIds: candidate.tagIds,
    suggestedTags: candidate.suggestedTags,
    rationale: candidate.rationale,
  };
}

export async function fetchAgentCandidates(jwt: string, projectId: number, status?: string): Promise<AgentCandidate[]> {
  const query = new URLSearchParams({ projectId: String(projectId) });
  if (status) query.set('status', status);
  const response = await fetch(`${apiServer}/agent/case-candidates?${query.toString()}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  const data = await response.json();
  return data.candidates || [];
}

export async function updateAgentCandidate(jwt: string, projectId: number, candidate: AgentCandidate) {
  const response = await fetch(`${apiServer}/agent/case-candidates/${candidate.id}?projectId=${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify(buildAgentCandidateUpdatePayload(candidate)),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function rejectAgentCandidate(jwt: string, projectId: number, candidateId: number) {
  const response = await fetch(`${apiServer}/agent/case-candidates/${candidateId}/reject?projectId=${projectId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

async function dryRunAcceptAgentCandidates({
  jwt,
  projectId,
  candidateIds,
  createMissingTags,
  allowPartial,
  idempotencyKey,
}: {
  jwt: string;
  projectId: number;
  candidateIds: number[];
  createMissingTags: boolean;
  allowPartial: boolean;
  idempotencyKey: string;
}): Promise<DryRunResponse> {
  const response = await fetch(`${apiServer}/agent/case-candidates/accept/dry-run?projectId=${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ candidateIds, createMissingTags, allowPartial, idempotencyKey }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}

export async function acceptAgentCandidates({
  jwt,
  projectId,
  candidateIds,
  createMissingTags,
  allowPartial,
}: {
  jwt: string;
  projectId: number;
  candidateIds: number[];
  createMissingTags: boolean;
  allowPartial: boolean;
}): Promise<AgentCandidateAcceptResult> {
  const idempotencyKey = `case-candidate-${projectId}-${candidateIds.join('-')}-${Date.now()}`;
  const dryRun = await dryRunAcceptAgentCandidates({
    jwt,
    projectId,
    candidateIds,
    createMissingTags,
    allowPartial,
    idempotencyKey,
  });
  const response = await fetch(`${apiServer}/agent/case-candidates/accept/commit?projectId=${projectId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      candidateIds,
      createMissingTags,
      allowPartial,
      idempotencyKey,
      operationToken: dryRun.dryRun.operationToken,
    }),
  });
  if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
  return response.json();
}
