# Add Include Subfolders direct-placement mode

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Add the explicit Include Subfolders narrowing control. Include Subfolders is on by default; turning it off makes the selected Test Case Folder show only Directly Placed Test Cases. The narrowed state must be reproducible through URL/API query state and visible through a Scope Indicator and direct-placement empty state.

## Acceptance criteria

- [ ] Include Subfolders defaults to on for folder Test Case views.
- [ ] Turning Include Subfolders off returns only Directly Placed Test Cases for the selected Test Case Folder.
- [ ] The narrowed false state is represented in URL/API query state so refreshes and shared links preserve it.
- [ ] The UI distinguishes Folder Scope from Directly Placed Test Cases with a Scope Indicator.
- [ ] Empty states distinguish a truly empty Folder Scope from a Direct Placement Empty State.
- [ ] Tests cover default-on behavior, direct-placement narrowing, URL/query preservation, Scope Indicator behavior, and empty-state copy.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/01-test-case-list-defaults-to-folder-scope.md

