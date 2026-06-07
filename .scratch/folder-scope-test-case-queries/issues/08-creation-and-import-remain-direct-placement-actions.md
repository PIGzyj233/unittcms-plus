# Creation and ordinary import remain direct-placement actions

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Protect the distinction between browsing a Folder Scope and creating Test Cases. New Test Cases and ordinary imported Test Cases should be directly placed in the selected Test Case Folder regardless of Include Subfolders state. They should not be automatically distributed into descendant folders.

## Acceptance criteria

- [ ] Creating a Test Case while a parent Test Case Folder is selected places it directly in the selected folder.
- [ ] Creating a Test Case while Include Subfolders is off still places it directly in the selected folder.
- [ ] Ordinary import while a parent Test Case Folder is selected places imported Test Cases directly in the selected folder.
- [ ] Ordinary import while Include Subfolders is off still places imported Test Cases directly in the selected folder.
- [ ] Imported or newly created Test Cases appear in the appropriate Folder Scope and direct-placement views after refresh.
- [ ] Tests cover creation and ordinary import landing behavior across both Include Subfolders states.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/02-add-include-subfolders-direct-placement-mode.md
