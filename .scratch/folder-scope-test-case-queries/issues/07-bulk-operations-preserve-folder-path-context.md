# Bulk operations preserve Folder Path context

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Ensure bulk operations work on selected Test Cases from a parent Folder Scope, including Test Cases directly owned by child folders. Move, clone, and delete should operate on the selected Test Cases themselves, while the UI keeps enough Folder Path context visible to make cross-folder selections deliberate.

## Acceptance criteria

- [ ] A user can select child-folder Test Cases shown in a parent Folder Scope and delete them.
- [ ] A user can select child-folder Test Cases shown in a parent Folder Scope and move them to a target Test Case Folder.
- [ ] A user can select child-folder Test Cases shown in a parent Folder Scope and clone them to a target Test Case Folder.
- [ ] Folder Path context remains visible enough during selection and bulk operation flows to avoid confusing direct ownership.
- [ ] Existing move, clone, and delete permission behavior remains unchanged.
- [ ] Tests cover bulk operations on Test Cases from descendant folders and verify result lists update correctly.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/01-test-case-list-defaults-to-folder-scope.md

