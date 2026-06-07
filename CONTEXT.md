# UnitTCMS

UnitTCMS manages test assets inside projects. This glossary keeps the product language around test case organization precise.

## Language

**Project**:
A workspace that contains a product team's test assets.

**Test Case**:
A reusable verification asset that belongs to exactly one Test Case Folder.
_Avoid_: Case asset

**Test Run**:
A planned or active execution of selected Test Cases. When Test Cases are selected for a Test Run from a Test Case Folder, the folder represents its Folder Scope unless the selection is explicitly narrowed.
_Avoid_: Run

**Test Case Folder**:
A hierarchical container inside a Project. A Test Case Folder can contain zero or more directly placed Test Cases and zero or more child Test Case Folders.
_Avoid_: Directory, node

**Folder Scope**:
The asset range represented by a Test Case Folder inside one Project; it includes the folder itself and every descendant Test Case Folder in that same Project. When a person or agent asks for, filters, exports, or selects Test Cases in a Folder Scope, they mean all Test Cases in that range unless they explicitly ask for only directly placed Test Cases.
_Avoid_: Current folder only, node-only folder

**Directly Placed Test Case**:
A Test Case whose immediate parent is the selected Test Case Folder. New or imported Test Cases created while a Test Case Folder is selected are Directly Placed Test Cases of that selected folder. Users narrow from a Folder Scope to Directly Placed Test Cases when they are reasoning about placement rather than coverage.
_Avoid_: Child case

**Include Subfolders**:
The explicit narrowing control for whether a selected Test Case Folder is interpreted as a Folder Scope. It is on by default; turning it off means only Directly Placed Test Cases are in scope. Include Subfolders is part of the view or query state, so links, API calls, and agent calls carry it when they need the narrowed meaning.
_Avoid_: Recursive mode

**Folder Scope Count**:
The number of Test Cases inside a Folder Scope. It is the primary count for a Test Case Folder because it previews the Test Cases represented by opening that folder.
_Avoid_: Direct count as the main folder count

**Scope Indicator**:
A lightweight label that names whether a Test Case list represents a Folder Scope or only Directly Placed Test Cases. It prevents people and agents from confusing asset range with direct folder ownership.
_Avoid_: Hidden scope

**Direct Placement Empty State**:
The empty state shown when a Test Case Folder has no Directly Placed Test Cases while its Folder Scope may still contain Test Cases. It must not imply that the full Folder Scope is empty.
_Avoid_: Generic empty folder

**Folder Path**:
The ordered chain of Test Case Folders from a Project's top-level folder to the Test Case Folder that directly contains a Test Case. Folder Scope results carry a Folder Path for each Test Case so direct ownership remains clear in a flat list, but Folder Path does not imply grouping.
_Avoid_: Breadcrumb, directory path

## Example Dialogue

Developer: "When a user opens the Login Test Case Folder, should the list include Test Cases under Login / Mobile?"

Domain expert: "Yes. Login is the Folder Scope, so it includes Test Cases directly in Login and in every descendant Test Case Folder."

Developer: "What if they only want items placed directly in Login?"

Domain expert: "Call that directly placed Test Cases, not the Folder Scope."

Developer: "How do they ask for only those directly placed Test Cases?"

Domain expert: "They turn off Include Subfolders. Otherwise Login means the Login Folder Scope. If that narrowed view is shared or automated, the narrowed state must be explicit."

Developer: "What number should the Login folder show in the folder tree?"

Domain expert: "Its Folder Scope Count. Directly placed counts can be secondary, but the main count should match what opening Login represents."

Developer: "How should someone know whether the list includes child folders?"

Domain expert: "Show a Scope Indicator. It should say whether the list is the Folder Scope or only directly placed Test Cases."

Developer: "What if Login has no directly placed Test Cases but Mobile has many?"

Domain expert: "Only the narrowed direct-placement view is empty. The Folder Scope is not empty."

Developer: "If I search for password reset while Login is selected, where should the search apply?"

Domain expert: "To the Login Folder Scope, including every descendant Test Case Folder, unless I have narrowed to directly placed Test Cases."

Developer: "What should export include from that same view?"

Domain expert: "The same Test Cases the view represents. Export follows the current Folder Scope or the narrowed directly placed set."

Developer: "Can I move, clone, or delete Test Cases from child folders while viewing Login?"

Domain expert: "Yes. Once a Test Case appears in the Login Folder Scope, selecting it is a concrete operation on that Test Case, regardless of its direct folder."

Developer: "If I add Test Cases to a Test Run from Login, what is included?"

Domain expert: "The Login Folder Scope, unless I have narrowed to directly placed Test Cases."

Developer: "If I create a Test Case while Login is selected, where does it belong?"

Domain expert: "It is directly placed in Login. Browsing a Folder Scope does not change the direct folder for creation or ordinary import."

Developer: "Should Test Cases from child folders be grouped by folder?"

Domain expert: "No. Show them in one list for scanning and bulk work, but show each Test Case's Folder Path so its direct folder remains clear."
