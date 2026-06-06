#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import { BackendClient } from './backendClient.js';
import { readHttpConfig } from './config.js';
import { createServer } from './server.js';

function extractBearerToken(req) {
  const header = req.headers.authorization || '';
  const prefix = 'Bearer ';
  if (!header.startsWith(prefix)) return null;

  const token = header.slice(prefix.length).trim();
  return token || null;
}

function hashBearerToken(token) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function unauthorized(res) {
  return res.status(401).json({ error: 'Unauthorized' });
}

function jsonRpcError(res, status, message) {
  return res.status(status).json({
    jsonrpc: '2.0',
    error: { code: -32000, message },
    id: null,
  });
}

function createHttpMcpApp({
  config,
  authClientFactory = (backendConfig) => new BackendClient({ config: backendConfig }),
  clientFactory = (backendConfig) => new BackendClient({ config: backendConfig }),
  now = () => Date.now(),
}) {
  const app = createMcpExpressApp({ host: config.mcpHost });
  const sessions = new Map();
  const authCache = new Map();
  const authClient = authClientFactory(config);

  function pruneExpiredSessions() {
    const currentTime = now();
    for (const [sessionId, session] of sessions.entries()) {
      if (currentTime - session.lastSeenAt > config.mcpSessionTtlMs) {
        sessions.delete(sessionId);
        session.close();
      }
    }
  }

  async function authenticateMcpRequest(req, res, next) {
    const token = extractBearerToken(req);
    if (!token) return unauthorized(res);

    const cacheKey = hashBearerToken(token);
    const cached = authCache.get(cacheKey);
    const currentTime = now();
    if (cached && cached.expiresAt > currentTime) {
      req.mcpAuth = cached.context;
      return next();
    }
    if (cached) authCache.delete(cacheKey);

    try {
      const context = await authClient.verifyMcpToken(token);
      authCache.set(cacheKey, {
        context,
        expiresAt: currentTime + config.mcpAuthCacheTtlMs,
      });
      req.mcpAuth = context;
      return next();
    } catch (error) {
      if (error.status === 401) return unauthorized(res);
      if (error.status === 403) return res.status(403).json({ error: 'Forbidden' });
      return res.status(503).json({ error: 'MCP token verification unavailable' });
    }
  }

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/mcp', authenticateMcpRequest);

  async function createSession(authContext) {
    pruneExpiredSessions();
    if (sessions.size >= config.mcpMaxSessions) {
      const error = new Error('Too many active MCP sessions');
      error.status = 429;
      throw error;
    }

    let sessionId;
    let session;
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (initializedSessionId) => {
        sessionId = initializedSessionId;
        sessions.set(initializedSessionId, session);
      },
    });
    const server = createServer({ client: clientFactory(config) });
    session = {
      server,
      transport,
      authContext,
      lastSeenAt: now(),
      close: async () => {
        if (sessionId) sessions.delete(sessionId);
        await transport.close();
        await server.close();
      },
    };
    transport.onclose = () => {
      if (sessionId) sessions.delete(sessionId);
    };
    await server.connect(transport);

    return session;
  }

  async function handlePost(req, res) {
    try {
      const sessionId = req.headers['mcp-session-id'];
      const session = sessionId ? sessions.get(sessionId) : null;
      if (session) {
        session.authContext = req.mcpAuth;
        session.lastSeenAt = now();
        await session.transport.handleRequest(req, res, req.body);
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const newSession = await createSession(req.mcpAuth);
        await newSession.transport.handleRequest(req, res, req.body);
        return;
      }

      jsonRpcError(res, 400, 'Bad Request: No valid session ID provided');
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        jsonRpcError(res, error.status || 500, error.message || 'Internal server error');
      }
    }
  }

  async function handleSessionRequest(req, res) {
    try {
      const sessionId = req.headers['mcp-session-id'];
      const session = sessionId ? sessions.get(sessionId) : null;
      if (!session) {
        jsonRpcError(res, 400, 'Bad Request: No valid session ID provided');
        return;
      }

      session.authContext = req.mcpAuth;
      session.lastSeenAt = now();
      await session.transport.handleRequest(req, res);
    } catch (error) {
      console.error('Error handling MCP session request:', error);
      if (!res.headersSent) {
        jsonRpcError(res, 500, 'Internal server error');
      }
    }
  }

  app.post('/mcp', handlePost);
  app.get('/mcp', handleSessionRequest);
  app.delete('/mcp', async (req, res) => {
    const sessionId = req.headers['mcp-session-id'];
    const session = sessionId ? sessions.get(sessionId) : null;
    await handleSessionRequest(req, res);
    if (sessionId && session) {
      sessions.delete(sessionId);
      await session.server.close();
    }
  });

  return { app, sessions, authCache };
}

function startHttpMcpServer(config = readHttpConfig()) {
  const { app } = createHttpMcpApp({ config });
  return new Promise((resolve, reject) => {
    const server = app.listen(config.mcpPort, config.mcpHost, () => {
      console.log(`UnitTCMS MCP server listening on http://${config.mcpHost}:${config.mcpPort}/mcp`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

async function main() {
  await startHttpMcpServer();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createHttpMcpApp, hashBearerToken, startHttpMcpServer };
