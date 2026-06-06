import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMcpToken, fetchMcpTokens, revokeMcpToken } from './mcpTokenControl';

function jsonResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('mcpTokenControl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches MCP token metadata with the user JWT', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ tokens: [{ id: 1, name: 'Codex' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchMcpTokens('jwt-token')).resolves.toEqual({ tokens: [{ id: 1, name: 'Codex' }] });

    expect(fetchMock).toHaveBeenCalledWith('/api/agent/mcp-tokens', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-token',
      },
    });
  });

  it('creates a token and returns the one-time plaintext value', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ token: 'uttcms_mcp_secret', record: { id: 2, name: 'Local agent' } }, { status: 201 })
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createMcpToken('jwt-token', { name: 'Local agent', expiresAt: '2026-07-01T00:00:00.000Z' })
    ).resolves.toEqual({
      token: 'uttcms_mcp_secret',
      record: { id: 2, name: 'Local agent' },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/agent/mcp-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-token',
      },
      body: JSON.stringify({ name: 'Local agent', expiresAt: '2026-07-01T00:00:00.000Z' }),
    });
  });

  it('revokes a token by id', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ record: { id: 3, status: 'revoked' } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(revokeMcpToken('jwt-token', 3)).resolves.toEqual({ record: { id: 3, status: 'revoked' } });

    expect(fetchMock).toHaveBeenCalledWith('/api/agent/mcp-tokens/3', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-token',
      },
    });
  });
});
