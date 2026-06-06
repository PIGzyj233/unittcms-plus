import Config from '@/config/config';

const apiServer = Config.apiServer;

export type McpTokenStatus = 'active' | 'expired' | 'revoked';

export type McpTokenRecord = {
  id: number;
  name: string;
  tokenPrefix: string;
  scopeType: 'global';
  projectId: number | null;
  createdByUserId: number | null;
  createdBy?: {
    id: number;
    email: string;
    username: string;
  } | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  status: McpTokenStatus;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreateMcpTokenInput = {
  name: string;
  expiresAt?: string | null;
};

async function requestMcpTokens(jwt: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiServer}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  return response.json();
}

async function fetchMcpTokens(jwt: string): Promise<{ tokens: McpTokenRecord[] }> {
  return requestMcpTokens(jwt, '/agent/mcp-tokens', { method: 'GET' });
}

async function createMcpToken(
  jwt: string,
  input: CreateMcpTokenInput
): Promise<{ token: string; record: McpTokenRecord }> {
  return requestMcpTokens(jwt, '/agent/mcp-tokens', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

async function revokeMcpToken(jwt: string, tokenId: number): Promise<{ record: McpTokenRecord }> {
  return requestMcpTokens(jwt, `/agent/mcp-tokens/${tokenId}`, { method: 'DELETE' });
}

export { createMcpToken, fetchMcpTokens, revokeMcpToken };
