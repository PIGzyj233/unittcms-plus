function readConfig(env = process.env) {
  for (const key of ['UNITTCMS_BACKEND_ORIGIN', 'UNITTCMS_BOT_EMAIL', 'UNITTCMS_BOT_PASSWORD']) {
    if (!env[key]) throw new Error(`${key} is required`);
  }

  return {
    backendOrigin: env.UNITTCMS_BACKEND_ORIGIN.replace(/\/$/, ''),
    botEmail: env.UNITTCMS_BOT_EMAIL,
    botPassword: env.UNITTCMS_BOT_PASSWORD,
  };
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('UNITTCMS_MCP_PORT must be an integer between 0 and 65535');
  }
  return port;
}

function parsePositiveInteger(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function readHttpConfig(env = process.env) {
  return {
    ...readConfig(env),
    mcpHost: env.UNITTCMS_MCP_HOST || '0.0.0.0',
    mcpPort: parsePort(env.UNITTCMS_MCP_PORT || '3333'),
    mcpSessionTtlMs: parsePositiveInteger(env.UNITTCMS_MCP_SESSION_TTL_MS || '1800000', 'UNITTCMS_MCP_SESSION_TTL_MS'),
    mcpMaxSessions: parsePositiveInteger(env.UNITTCMS_MCP_MAX_SESSIONS || '100', 'UNITTCMS_MCP_MAX_SESSIONS'),
    mcpAuthCacheTtlMs: parsePositiveInteger(
      env.UNITTCMS_MCP_AUTH_CACHE_TTL_MS || '30000',
      'UNITTCMS_MCP_AUTH_CACHE_TTL_MS'
    ),
  };
}

export { readConfig, readHttpConfig };
