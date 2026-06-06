import { AgentCandidateMessages } from '@/types/agentCandidate';

export function formatAgentCandidateSource(source: string, messages: AgentCandidateMessages) {
  if (!source || source.includes(':')) {
    return messages.automatedSuggestion;
  }

  return source;
}
