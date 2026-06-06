import { afterEach, describe, expect, test, vi } from 'vitest';
import { updateAgentCandidate } from './agentCandidateControl';
import { AgentCandidate } from '@/types/agentCandidate';

const candidate: AgentCandidate = {
  id: 7,
  projectId: 3,
  folderId: 11,
  title: 'Candidate title',
  description: 'Candidate description',
  preConditions: 'Preconditions',
  expectedResults: 'Expected results',
  priority: 2,
  type: 4,
  automationStatus: 1,
  template: 0,
  steps: [{ step: 'Step 1', result: 'Result 1' }],
  tagIds: [5, 6],
  suggestedTags: ['Regression'],
  source: 'agent:mcp',
  rationale: 'Suggested from imported notes',
  duplicateMetadata: { blocked: false, warnings: [] },
  status: 'draft',
  acceptedCaseId: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('updateAgentCandidate', () => {
  test('sends only editable candidate fields accepted by the update API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidate }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    await updateAgentCandidate('jwt', 3, candidate);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({
      title: 'Candidate title',
      description: 'Candidate description',
      preConditions: 'Preconditions',
      expectedResults: 'Expected results',
      rationale: 'Suggested from imported notes',
      steps: [{ step: 'Step 1', result: 'Result 1' }],
      tagIds: [5, 6],
      suggestedTags: ['Regression'],
    });
  });
});
