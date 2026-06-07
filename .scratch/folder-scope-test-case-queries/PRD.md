# PRD: Folder Scope Defaults for Test Case Folder Queries

Status: ready-for-agent

Related ADR: Folder Scope Is Default for Test Case Folder Queries

## Problem Statement

When a user opens a parent Test Case Folder, UnitTCMS currently shows only Directly Placed Test Cases in that folder. Users experience this as missing test assets because an asset platform folder represents the folder's full Folder Scope: the selected folder plus every descendant Test Case Folder inside the same Project.

This mismatch appears in multiple product surfaces. A test manager can open a parent folder and fail to see child-folder Test Cases, export a result set that does not match what they expected, use a Test Run folder selector that silently excludes descendant Test Cases, or ask an agent through MCP for folder Test Cases and receive a narrower answer than the human UI should provide. The current behavior makes `folderId` feel like an implementation detail rather than a product concept.

## Solution

Make Folder Scope the default meaning of Test Case Folder queries across the product. When a person or agent asks for Test Cases in a Test Case Folder, the result includes Test Cases directly placed in that folder and Test Cases in all descendant Test Case Folders. Users and agents can explicitly narrow to Directly Placed Test Cases by turning off Include Subfolders.

The Test Case list remains flat, not grouped. Each Test Case returned from a Folder Scope query includes its Folder Path so users and agents can understand direct ownership. Exports, Test Run case selection, folder tree counts, REST APIs, and MCP tools must all use the same semantics so the same folder does not produce contradictory answers in different workflows.

## User Stories

1. As a test manager, I want opening a parent Test Case Folder to show Test Cases from its child folders, so that I can review all assets under that area.
2. As a QA lead, I want a Login Test Case Folder to represent Login and all descendant folders, so that folder navigation matches how I think about product areas.
3. As a tester, I want Test Cases in child folders to appear when I select a parent folder, so that I do not miss relevant coverage.
4. As a tester, I want Test Cases from a Folder Scope to appear in one flat list, so that I can scan, search, sort, and select them efficiently.
5. As a tester, I want each Test Case in a parent-folder list to show its Folder Path, so that I know where it directly belongs.
6. As a test manager, I want the Folder Path to remain visible for child-folder Test Cases, so that I do not mistake them for Directly Placed Test Cases.
7. As a test manager, I want Include Subfolders to be on by default, so that opening a Test Case Folder means seeing the full Folder Scope.
8. As a test organizer, I want to turn off Include Subfolders, so that I can inspect only Directly Placed Test Cases.
9. As a test organizer, I want the narrowed direct-placement view to be explicit, so that I know I am no longer seeing the full Folder Scope.
10. As a tester, I want the URL to preserve the Include Subfolders state when it is narrowed, so that refreshes and shared links keep the same view.
11. As a tester, I want search to apply across the Folder Scope by default, so that child-folder Test Cases can be found from the parent folder.
12. As a tester, I want priority filters to apply across the Folder Scope by default, so that filtering does not silently ignore child folders.
13. As a tester, I want type filters to apply across the Folder Scope by default, so that the folder range and filters work together.
14. As a tester, I want tag filters to apply across the Folder Scope by default, so that tagged child-folder Test Cases are included.
15. As a QA lead, I want filtered parent-folder results to include Folder Paths, so that I can understand why each matching Test Case appears.
16. As a test manager, I want export to follow the current Folder Scope or narrowed direct-placement view, so that the exported file matches the visible result set.
17. As a test manager, I want exported CSV results to include Folder Path, so that exported rows remain understandable outside the app.
18. As a test manager, I want exported JSON results to include Folder Path, so that downstream tools can preserve folder ownership context.
19. As a tester, I want creating a new Test Case from a parent folder to place it directly in that selected folder, so that creation has an unambiguous destination.
20. As a tester, I want ordinary import from a parent folder to place imported Test Cases directly in the selected folder, so that import has an unambiguous destination.
21. As a test organizer, I want creation and ordinary import to be independent of Include Subfolders, so that browsing a scope does not scatter newly created assets.
22. As a test manager, I want bulk delete to work on selected child-folder Test Cases shown in a parent Folder Scope, so that visible selected assets can be acted on.
23. As a test manager, I want bulk move to work on selected child-folder Test Cases shown in a parent Folder Scope, so that I can reorganize assets from an aggregate view.
24. As a test manager, I want bulk clone to work on selected child-folder Test Cases shown in a parent Folder Scope, so that aggregate views support repeated asset work.
25. As a test manager, I want the UI to show when selected Test Cases come from multiple Folder Paths, so that bulk operations feel deliberate.
26. As a test manager, I want Test Run case selection by Test Case Folder to default to the Folder Scope, so that adding a product area to a Test Run includes its descendant Test Cases.
27. As a tester building a Test Run, I want to narrow Test Run case selection to Directly Placed Test Cases when needed, so that I can build a run from only the selected folder's direct contents.
28. As a QA lead, I want folder tree counts to reflect Folder Scope Count, so that the count previews what opening the folder represents.
29. As a QA lead, I want directly placed counts to be available only as secondary context when useful, so that the main folder count is not misleading.
30. As a tester, I want an empty parent-folder scope to mean no Test Cases exist anywhere in the Folder Scope, so that empty states are trustworthy.
31. As a test organizer, I want a direct-placement empty state to say that the selected folder has no Directly Placed Test Cases, so that I do not think child-folder assets are missing.
32. As a user sharing a link, I want the narrowed direct-placement state to be encoded in the link, so that another user sees the same narrowed view.
33. As an agent user, I want MCP `search_cases` with a folder to return the Folder Scope by default, so that the agent and human UI agree.
34. As an agent user, I want MCP `search_cases` to accept an explicit Include Subfolders option, so that agents can request Directly Placed Test Cases when placement matters.
35. As an agent user, I want MCP `search_cases` results to include Folder Path, so that the agent can explain where each Test Case belongs.
36. As an API consumer, I want REST Test Case queries with a folder to default to the Folder Scope, so that the API matches product language.
37. As an API consumer, I want REST Test Case queries to accept Include Subfolders, so that direct-placement queries remain possible.
38. As an API consumer, I want returned Test Cases to include authoritative Folder Path, so that clients do not each reconstruct paths differently.
39. As a maintainer, I want Folder Path generated by the backend, so that UI, export, and MCP receive consistent ownership context.
40. As a maintainer, I want Folder Scope traversal constrained to one Project, so that folder queries never cross project boundaries.
41. As a maintainer, I want permission checks to remain project-based, so that existing visibility and editability boundaries are respected.
42. As a maintainer, I want descendant-folder lookup to tolerate malformed cross-project parent links by staying inside the selected Project, so that data anomalies do not leak assets.
43. As a maintainer, I want the old direct-folder behavior available only through an explicit flag, so that the default becomes the corrected asset-platform semantic.
44. As a maintainer, I want tests to lock the Folder Scope default, so that future changes do not regress to direct-only folder matching.
45. As a maintainer, I want tests to lock the Include Subfolders false behavior, so that direct-placement workflows remain supported.
46. As a maintainer, I want tests to verify export, MCP, and Test Run selection semantics, so that all surfaces stay aligned.
47. As a maintainer, I want folder tree count tests to distinguish Folder Scope Count from directly placed count, so that counts remain meaningful.
48. As a maintainer, I want UI tests around empty state and scope indicator behavior, so that users can tell which scope they are seeing.

## Implementation Decisions

- Test Case Folder queries default to Folder Scope. The selected folder and all descendant Test Case Folders inside the same Project are included.
- Include Subfolders is the explicit narrowing control. It is true by default. When false, queries return only Directly Placed Test Cases.
- Existing `folderId` query/input semantics are corrected rather than renamed. `folderId` remains the selected Test Case Folder; Include Subfolders decides whether it is interpreted as a Folder Scope or direct-placement query.
- Folder Scope queries must never cross Project boundaries. The selected folder must belong to the requested or visible Project, and descendant traversal must remain inside that Project.
- Backend/API responses provide authoritative Folder Path for each returned Test Case. Clients should not independently reconstruct the path as the source of truth.
- Folder Scope query results remain flat. Folder Path is shown as context and may be sortable, but it does not imply grouping.
- The Test Case list UI adds an Include Subfolders control. The control defaults on and writes the narrowed false state into URL/query state.
- The Test Case list UI adds a Scope Indicator. It distinguishes full Folder Scope from Directly Placed Test Cases.
- The Test Case list UI shows Folder Path for returned Test Cases, especially when Include Subfolders is on.
- Creating a new Test Case from a selected Test Case Folder places it directly in the selected folder, regardless of Include Subfolders.
- Ordinary import from a selected Test Case Folder places imported Test Cases directly in the selected folder, regardless of Include Subfolders.
- Search, priority, type, and tag filters apply to the current query scope. With Include Subfolders on, they apply across the Folder Scope.
- Export follows the current query scope and filters. A user exporting from a Folder Scope receives the same Test Cases represented by that view.
- Exported CSV and JSON include Folder Path so exported Test Cases remain explainable outside the app.
- Bulk delete, move, and clone operate on the selected Test Cases in the current result set, even when those Test Cases are directly owned by child folders.
- Test Run case selection by Test Case Folder defaults to Folder Scope and supports explicit narrowing to Directly Placed Test Cases.
- The primary count shown for a Test Case Folder is Folder Scope Count. Directly placed count may be available as secondary context but is not the main count.
- Empty states distinguish a truly empty Folder Scope from a Direct Placement Empty State.
- MCP `search_cases` accepts Include Subfolders and defaults it to true. Its folder behavior matches the REST/API and human UI behavior.
- MCP `search_cases` returns Folder Path for Test Cases in the result set.
- Agent folder tree responses should expose counts that represent Folder Scope Count as the primary count.
- This is a semantic correction. Existing direct-only behavior is intentionally moved behind an explicit Include Subfolders false state.
- The ADR for Folder Scope defaults governs this work and should be respected during implementation.

## Testing Decisions

- Good tests should verify observable product behavior: which Test Cases are returned, what counts are reported, which query state is preserved, and what context is exposed. They should not assert private traversal implementation details.
- Backend route tests are the highest-value seam for REST behavior. They should cover default Folder Scope queries, Include Subfolders false, search/filter behavior across descendants, Project boundary protection, and Folder Path in returned Test Cases.
- Export route tests should verify that default export includes descendant Test Cases, Include Subfolders false narrows export to Directly Placed Test Cases, and exported CSV/JSON includes Folder Path.
- Agent route tests should verify that agent Test Case search defaults to Folder Scope, supports Include Subfolders false, preserves existing filters, and returns Folder Path.
- MCP tool schema and handler tests should verify Include Subfolders is accepted, defaults are safe, and the flag is passed through to the backend only when needed or in a clearly defined way.
- Agent folder tree tests should verify Folder Scope Count is the primary count and direct counts do not replace it.
- Frontend utility tests should cover query construction for Include Subfolders and Folder Path data handling.
- Test Case page component tests should cover the Include Subfolders control, URL state, Scope Indicator, Folder Path display, and the direct-placement empty state.
- Test Run editor tests should cover folder selection using Folder Scope by default and direct-placement narrowing when Include Subfolders is off.
- Existing tests around Test Case routes, agent case search, agent folder tree, MCP tool schemas, folder tree building, Test Case panes, and Test Run editor behavior are the preferred prior art.
- E2E coverage is useful if the implementation changes user-visible navigation or table behavior significantly, but route/component tests should carry the core semantic guarantees.

## Out of Scope

- Changing the data model for Test Case ownership. Each Test Case still belongs to exactly one Test Case Folder.
- Automatically distributing ordinary imports into child folders based on file contents.
- Introducing a grouped-by-folder Test Case list as the default presentation.
- Renaming `folderId` to `folderScopeId` across public interfaces.
- Changing project-level visibility or editability semantics beyond ensuring Folder Scope traversal stays inside one Project.
- Reworking Test Case Folder drag/drop, folder creation, or folder deletion semantics except where counts and query results need to reflect Folder Scope.
- Changing advanced case candidate creation semantics beyond respecting existing direct folder ownership.
- Replacing the current table sorting model. Folder Path may become visible and sortable, but default grouping/sorting by path is not required.

## Further Notes

- The domain glossary defines Project, Test Case, Test Run, Test Case Folder, Folder Scope, Directly Placed Test Case, Include Subfolders, Folder Scope Count, Scope Indicator, Direct Placement Empty State, and Folder Path. Implementation language should use those terms.
- The current code has multiple direct-folder seams that will need coordinated updates: standard Test Case list queries, standard export, agent search, MCP `search_cases`, folder tree counts, and Test Run case selection.
- The current behavior is best understood as an implementation accident rather than a desired product model. The new default aligns UnitTCMS with asset-platform expectations.
