import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, expect, it } from 'vitest';

import { createHttpMcpApp } from './httpServer.js';

const openServers = [];
const baseConfig = {
  backendOrigin: 'http://backend.test',
  botEmail: 'bot@example.com',
  botPassword: 'secret',
  mcpHost: '127.0.0.1',
  mcpPort: 0,
  mcpSessionTtlMs: 1_800_000,
  mcpMaxSessions: 100,
  mcpAuthCacheTtlMs: 30_000,
};

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      openServers.push(server);
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
    server.on('error', reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe('HTTP MCP server', () => {
  afterEach(async () => {
    await Promise.all(openServers.splice(0).map(close));
  });

  it('serves health checks without MCP bearer authentication', async () => {
    const { app } = createHttpMcpApp({
      config: baseConfig,
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);

    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejects MCP requests without the configured bearer token', async () => {
    const { app } = createHttpMcpApp({
      config: baseConfig,
      authClientFactory: () => ({ verifyMcpToken: async () => ({}) }),
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });

  it('rejects MCP requests when backend token verification rejects the bearer token', async () => {
    const { app } = createHttpMcpApp({
      config: baseConfig,
      authClientFactory: () => ({
        verifyMcpToken: async () => {
          const error = new Error('Unauthorized');
          error.status = 401;
          throw error;
        },
      }),
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer invalid-token' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });

    expect(response.status).toBe(401);
  });

  it('exposes tools over Streamable HTTP when database token verification succeeds', async () => {
    const authCalls = [];
    const { app, authCache } = createHttpMcpApp({
      config: baseConfig,
      authClientFactory: () => ({
        verifyMcpToken: async (token) => {
          authCalls.push(token);
          return { tokenId: 1, scopeType: 'global', projectId: null, permissions: [] };
        },
      }),
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: 'Bearer uttcms_mcp_valid' },
      },
    });

    await client.connect(transport);
    const tools = await client.listTools();

    expect(tools.tools.map((tool) => tool.name)).toContain('search_cases');
    expect(tools.tools.map((tool) => tool.name)).toContain('create_case_candidate');
    expect(tools.tools.map((tool) => tool.name)).toContain('list_projects');
    expect(authCalls).toEqual(['uttcms_mcp_valid']);
    expect([...authCache.keys()]).not.toContain('uttcms_mcp_valid');

    await client.close();
  });

  it('revalidates bearer tokens after the auth cache TTL', async () => {
    let now = 1_000;
    let tokenAllowed = true;
    const { app, sessions } = createHttpMcpApp({
      config: { ...baseConfig, mcpAuthCacheTtlMs: 10 },
      now: () => now,
      authClientFactory: () => ({
        verifyMcpToken: async () => {
          if (!tokenAllowed) {
            const error = new Error('Unauthorized');
            error.status = 401;
            throw error;
          }
          return { tokenId: 1, scopeType: 'global', projectId: null, permissions: [] };
        },
      }),
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: 'Bearer uttcms_mcp_revoked' },
      },
    });

    await client.connect(transport);
    const sessionId = sessions.keys().next().value;
    tokenAllowed = false;
    now += 11;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer uttcms_mcp_revoked',
        'Mcp-Session-Id': sessionId,
      },
    });

    expect(response.status).toBe(401);
    await client.close().catch(() => {});
  });

  it('removes sessions when clients delete the MCP session', async () => {
    const { app, sessions } = createHttpMcpApp({
      config: baseConfig,
      authClientFactory: () => ({
        verifyMcpToken: async () => ({ tokenId: 1, scopeType: 'global', projectId: null, permissions: [] }),
      }),
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);
    const client = new Client({ name: 'test-client', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: 'Bearer uttcms_mcp_valid' },
      },
    });

    await client.connect(transport);
    expect(sessions.size).toBe(1);
    const sessionId = sessions.keys().next().value;

    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer uttcms_mcp_valid',
        'Mcp-Session-Id': sessionId,
      },
    });

    expect(response.status).toBe(200);
    expect(sessions.size).toBe(0);
    await client.close().catch(() => {});
  });

  it('rejects new sessions when the configured session cap is reached', async () => {
    const { app } = createHttpMcpApp({
      config: { ...baseConfig, mcpMaxSessions: 1 },
      authClientFactory: () => ({
        verifyMcpToken: async () => ({ tokenId: 1, scopeType: 'global', projectId: null, permissions: [] }),
      }),
      clientFactory: () => ({ request: async () => ({}) }),
    });
    const { baseUrl } = await listen(app);
    const firstClient = new Client({ name: 'first-client', version: '1.0.0' });
    const firstTransport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: 'Bearer uttcms_mcp_valid' },
      },
    });
    const secondClient = new Client({ name: 'second-client', version: '1.0.0' });
    const secondTransport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: {
        headers: { Authorization: 'Bearer uttcms_mcp_valid' },
      },
    });

    await firstClient.connect(firstTransport);
    await expect(secondClient.connect(secondTransport)).rejects.toThrow();

    await firstClient.close();
  });
});
