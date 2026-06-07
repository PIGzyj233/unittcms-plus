# MCP search_cases uses Folder Scope semantics

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Align agent and MCP Test Case search with the product's Folder Scope semantics. `search_cases` should treat a folder as a Folder Scope by default, accept an explicit Include Subfolders false option for direct-placement searches, and return Folder Path for Test Cases so agents can explain direct ownership.

## Acceptance criteria

- [ ] Agent Test Case search defaults to Folder Scope when a Test Case Folder is provided.
- [ ] Agent Test Case search supports Include Subfolders false for Directly Placed Test Cases.
- [ ] MCP `search_cases` accepts the Include Subfolders input and passes the chosen scope to the backend.
- [ ] MCP `search_cases` results include Folder Path for returned Test Cases.
- [ ] Existing keyword, tag, priority, type, and run filters continue to work with both scope modes.
- [ ] Tests cover agent route behavior, MCP schema validation, MCP request construction, Folder Path output, and filter preservation.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/01-test-case-list-defaults-to-folder-scope.md
- .scratch/folder-scope-test-case-queries/issues/02-add-include-subfolders-direct-placement-mode.md

