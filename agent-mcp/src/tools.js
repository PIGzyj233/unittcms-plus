import {
  acceptCandidatesCommitInputSchema,
  acceptCandidatesInputSchema,
  addCasesToRunCommitInputSchema,
  addCasesToRunInputSchema,
  createCandidateInputSchema,
  emptyInputSchema,
  folderPathCommitInputSchema,
  folderPathInputSchema,
  getCaseInputSchema,
  listCandidateInputSchema,
  projectInputSchema,
  runCommitInputSchema,
  runInputSchema,
  searchCasesInputSchema,
} from './toolSchemas.js';

function backendToolResult(backendBody) {
  return {
    structuredContent: backendBody,
    content: [{ type: 'text', text: JSON.stringify(backendBody) }],
  };
}

function appendQueryValue(params, key, value) {
  if (value === undefined || value === null) return;
  params.set(key, Array.isArray(value) ? value.join(',') : String(value));
}

function projectPath(path, input, queryKeys = []) {
  const params = new URLSearchParams();
  params.set('projectId', String(input.projectId));
  for (const key of queryKeys) {
    appendQueryValue(params, key, input[key]);
  }
  return `${path}?${params.toString()}`;
}

function bodyWithout(input, excludedKeys) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !excludedKeys.includes(key)));
}

function jsonOptions(body) {
  return {
    method: 'POST',
    body: JSON.stringify(body),
  };
}

function makeHandler({ schema, request }) {
  return async (rawInput) => {
    const input = schema.parse(rawInput);
    const backendBody = await request(input);
    return backendToolResult(backendBody);
  };
}

function createTools(client) {
  return {
    list_projects: {
      description: 'List UnitTCMS projects currently visible to the agent service principal.',
      inputSchema: emptyInputSchema,
      handler: makeHandler({
        schema: emptyInputSchema,
        request: async () => {
          const projects = await client.request('/projects', { method: 'GET' });
          return { projects };
        },
      }),
    },
    search_cases: {
      description: 'Search formal test cases in a UnitTCMS project.',
      inputSchema: searchCasesInputSchema,
      handler: makeHandler({
        schema: searchCasesInputSchema,
        request: (input) =>
          client.request(projectPath('/agent/cases', input, [
            'folderId',
            'includeSubfolders',
            'priority',
            'type',
            'includedInRunId',
            'keyword',
            'tagIds',
          ]), { method: 'GET' }),
      }),
    },
    get_case: {
      description: 'Get one formal test case by id.',
      inputSchema: getCaseInputSchema,
      handler: makeHandler({
        schema: getCaseInputSchema,
        request: (input) => client.request(projectPath(`/agent/cases/${input.caseId}`, input), { method: 'GET' }),
      }),
    },
    get_folder_tree: {
      description: 'Get the folder tree for a UnitTCMS project.',
      inputSchema: projectInputSchema,
      handler: makeHandler({
        schema: projectInputSchema,
        request: (input) => client.request(projectPath('/agent/folders/tree', input), { method: 'GET' }),
      }),
    },
    ensure_folder_path_dry_run: {
      description: 'Dry-run creation of a folder path.',
      inputSchema: folderPathInputSchema,
      handler: makeHandler({
        schema: folderPathInputSchema,
        request: (input) =>
          client.request(projectPath('/agent/folders/ensure-path/dry-run', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    ensure_folder_path_commit: {
      description: 'Commit creation of a folder path after a dry-run.',
      inputSchema: folderPathCommitInputSchema,
      handler: makeHandler({
        schema: folderPathCommitInputSchema,
        request: (input) =>
          client.request(projectPath('/agent/folders/ensure-path/commit', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    create_case_candidate: {
      description: 'Create a draft case candidate.',
      inputSchema: createCandidateInputSchema,
      handler: makeHandler({
        schema: createCandidateInputSchema,
        request: (input) =>
          client.request(projectPath('/agent/case-candidates', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    list_case_candidates: {
      description: 'List case candidates.',
      inputSchema: listCandidateInputSchema,
      handler: makeHandler({
        schema: listCandidateInputSchema,
        request: (input) => client.request(projectPath('/agent/case-candidates', input, ['status']), { method: 'GET' }),
      }),
    },
    accept_case_candidates_dry_run: {
      description: 'Dry-run accepting case candidates into formal cases.',
      inputSchema: acceptCandidatesInputSchema,
      handler: makeHandler({
        schema: acceptCandidatesInputSchema,
        request: (input) =>
          client.request(projectPath('/agent/case-candidates/accept/dry-run', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    accept_case_candidates_commit: {
      description: 'Commit accepting case candidates into formal cases after a dry-run.',
      inputSchema: acceptCandidatesCommitInputSchema,
      handler: makeHandler({
        schema: acceptCandidatesCommitInputSchema,
        request: (input) =>
          client.request(projectPath('/agent/case-candidates/accept/commit', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    create_run_dry_run: {
      description: 'Dry-run creating a test run with cases.',
      inputSchema: runInputSchema,
      handler: makeHandler({
        schema: runInputSchema,
        request: (input) => client.request(projectPath('/agent/runs/dry-run', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    create_run_commit: {
      description: 'Commit creating a test run with cases after a dry-run.',
      inputSchema: runCommitInputSchema,
      handler: makeHandler({
        schema: runCommitInputSchema,
        request: (input) => client.request(projectPath('/agent/runs/commit', input), jsonOptions(bodyWithout(input, ['projectId']))),
      }),
    },
    add_cases_to_run_dry_run: {
      description: 'Dry-run adding cases to an existing run.',
      inputSchema: addCasesToRunInputSchema,
      handler: makeHandler({
        schema: addCasesToRunInputSchema,
        request: (input) =>
          client.request(
            projectPath(`/agent/runs/${input.runId}/cases/dry-run`, input),
            jsonOptions(bodyWithout(input, ['projectId', 'runId']))
          ),
      }),
    },
    add_cases_to_run_commit: {
      description: 'Commit adding cases to an existing run after a dry-run.',
      inputSchema: addCasesToRunCommitInputSchema,
      handler: makeHandler({
        schema: addCasesToRunCommitInputSchema,
        request: (input) =>
          client.request(
            projectPath(`/agent/runs/${input.runId}/cases/commit`, input),
            jsonOptions(bodyWithout(input, ['projectId', 'runId']))
          ),
      }),
    },
  };
}

export { backendToolResult, createTools };
