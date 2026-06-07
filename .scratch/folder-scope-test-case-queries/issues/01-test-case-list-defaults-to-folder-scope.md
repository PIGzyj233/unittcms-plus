# Test Case list defaults to Folder Scope

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Make the Test Case list interpret the selected Test Case Folder as a Folder Scope by default. Opening a parent folder should return Test Cases directly placed in that folder plus Test Cases in all descendant Test Case Folders inside the same Project. The list remains flat and every returned Test Case carries its authoritative Folder Path so direct ownership stays clear.

## Acceptance criteria

- [ ] Opening a parent Test Case Folder shows Test Cases from the selected folder and descendant Test Case Folders by default.
- [ ] Search, priority, type, and tag filters apply across the default Folder Scope.
- [ ] Each Test Case returned by the default folder query includes Folder Path context suitable for UI display and API consumers.
- [ ] Folder Scope traversal is constrained to the selected Project and cannot include Test Cases from another Project.
- [ ] Tests cover the default Folder Scope behavior, filtering across descendants, Folder Path in results, and Project boundary protection.

## Blocked by

None - can start immediately

