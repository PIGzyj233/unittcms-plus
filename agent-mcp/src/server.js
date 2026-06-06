#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { BackendClient } from './backendClient.js';
import { readConfig } from './config.js';
import { createTools } from './tools.js';

function createServer({ client }) {
  const server = new McpServer({
    name: 'unittcms-agent-mcp',
    version: '0.1.0',
  });
  const tools = createTools(client);

  for (const [name, tool] of Object.entries(tools)) {
    server.registerTool(
      name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
      },
      tool.handler
    );
  }

  return server;
}

async function main() {
  const config = readConfig();
  const client = new BackendClient({ config });
  const server = createServer({ client });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { createServer };
