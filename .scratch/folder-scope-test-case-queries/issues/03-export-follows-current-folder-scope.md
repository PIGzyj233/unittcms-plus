# Export follows current Folder Scope

Status: ready-for-agent

## Parent

.scratch/folder-scope-test-case-queries/PRD.md

## What to build

Make Test Case export match the current folder query scope and filters. Exporting from a Folder Scope should include descendant Test Cases; exporting from a narrowed direct-placement view should include only Directly Placed Test Cases. CSV and JSON exports should include Folder Path so exported rows remain explainable outside UnitTCMS.

## Acceptance criteria

- [ ] Default export from a parent Test Case Folder includes Test Cases from descendant Test Case Folders.
- [ ] Export respects Include Subfolders false by exporting only Directly Placed Test Cases.
- [ ] Export respects the same search, priority, type, and tag filters as the visible list.
- [ ] CSV export includes Folder Path for each exported Test Case.
- [ ] JSON export includes Folder Path for each exported Test Case.
- [ ] Tests cover default Folder Scope export, direct-placement export, filter preservation, and Folder Path in CSV/JSON output.

## Blocked by

- .scratch/folder-scope-test-case-queries/issues/01-test-case-list-defaults-to-folder-scope.md
- .scratch/folder-scope-test-case-queries/issues/02-add-include-subfolders-direct-placement-mode.md

