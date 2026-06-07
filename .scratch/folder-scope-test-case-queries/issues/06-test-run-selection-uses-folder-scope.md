# Test Run selection uses Folder Scope

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Make Test Run case selection by Test Case Folder use Folder Scope by default. Selecting a parent folder while building or editing a Test Run should surface Test Cases from the selected folder and all descendant Test Case Folders, with an explicit Include Subfolders false mode for direct-placement selection.

## Acceptance criteria

- [ ] Test Run case selection by parent Test Case Folder includes descendant Test Cases by default.
- [ ] Test Run case selection supports narrowing to Directly Placed Test Cases.
- [ ] Folder Path context is available when Test Cases from descendant folders appear in the selection list.
- [ ] Existing Test Run selection, inclusion, and exclusion behavior continues to work after scope changes.
- [ ] Tests cover default Folder Scope selection, direct-placement narrowing, and preservation of existing Test Run case selection behavior.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/01-test-case-list-defaults-to-folder-scope.md
- .scratch/folder-scope-test-case-queries/issues/02-add-include-subfolders-direct-placement-mode.md

