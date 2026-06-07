# Folder tree shows Folder Scope Count

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Make the primary count for a Test Case Folder represent Folder Scope Count. Parent folders should preview the number of Test Cases users and agents will see when opening the Folder Scope. Directly placed counts may be exposed only as secondary context when useful, but they must not replace the main count.

## Acceptance criteria

- [ ] A parent Test Case Folder's primary count includes Test Cases in descendant Test Case Folders.
- [ ] A leaf Test Case Folder's primary count matches its directly placed Test Cases.
- [ ] Directly placed count does not replace Folder Scope Count as the main count.
- [ ] Agent folder tree responses expose Folder Scope Count as the primary count.
- [ ] Tests distinguish Folder Scope Count from directly placed count for parent folders.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/01-test-case-list-defaults-to-folder-scope.md

