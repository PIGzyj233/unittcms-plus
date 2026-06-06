import { describe, expect, it } from 'vitest';

import { candidateInputSchema, runInputSchema } from './toolSchemas.js';
import { createTools } from './tools.js';

describe('agent MCP config and schemas', () => {
  it('rejects unknown candidate input fields', () => {
    expect(() => candidateInputSchema.parse({ title: 'A', unknown: true })).toThrow();
  });

  it('rejects unknown run input fields', () => {
    expect(() => runInputSchema.parse({ projectId: 1, name: 'Smoke', caseIds: [2], surprise: true })).toThrow();
  });
});

describe('agent MCP tools', () => {
  it('exposes the requested tool names', () => {
    const tools = createTools({ request: async () => ({}) });

    expect(Object.keys(tools)).toEqual([
      'search_cases',
      'get_case',
      'get_folder_tree',
      'ensure_folder_path_dry_run',
      'ensure_folder_path_commit',
      'create_case_candidate',
      'list_case_candidates',
      'accept_case_candidates_dry_run',
      'accept_case_candidates_commit',
      'create_run_dry_run',
      'create_run_commit',
      'add_cases_to_run_dry_run',
      'add_cases_to_run_commit',
    ]);
  });

  it('calls the expected backend path and returns structured and text content', async () => {
    const calls = [];
    const client = {
      async request(path, options) {
        calls.push({ path, options });
        return { cases: [{ id: 2, title: 'Login' }] };
      },
    };
    const tools = createTools(client);

    const result = await tools.search_cases.handler({ projectId: 1, keyword: 'login', tagIds: [3, 4] });

    expect(calls).toEqual([
      {
        path: '/agent/cases?projectId=1&keyword=login&tagIds=3%2C4',
        options: { method: 'GET' },
      },
    ]);
    expect(result).toEqual({
      structuredContent: { cases: [{ id: 2, title: 'Login' }] },
      content: [{ type: 'text', text: JSON.stringify({ cases: [{ id: 2, title: 'Login' }] }) }],
    });
  });

  it('posts candidate bodies to the expected backend path', async () => {
    const calls = [];
    const client = {
      async request(path, options) {
        calls.push({ path, options });
        return { candidate: { id: 5, title: 'Checkout' } };
      },
    };
    const tools = createTools(client);

    await tools.create_case_candidate.handler({
      projectId: 1,
      title: 'Checkout',
      folderId: 7,
      priority: 'P1',
      type: 'functional',
      automationStatus: 'manual',
      template: 'text',
      steps: [{ step: 'Buy', result: 'Order created' }],
    });

    expect(calls).toEqual([
      {
        path: '/agent/case-candidates?projectId=1',
        options: {
          method: 'POST',
          body: JSON.stringify({
            title: 'Checkout',
            folderId: 7,
            priority: 'P1',
            type: 'functional',
            automationStatus: 'manual',
            template: 'text',
            steps: [{ step: 'Buy', result: 'Order created' }],
          }),
        },
      },
    ]);
  });
});
