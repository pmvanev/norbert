<!-- markdownlint-disable MD024 -->

# User Stories: Plugin Architecture and Layout Engine (Phase 3)

## Story Map Overview

```
Workflow:  [Plugin API]  --> [Plugin Load]  --> [Layout Engine]  --> [Multi-Window]  --> [Sidebar]   --> [Presets]     --> [Validation]
              |                  |                   |                   |                  |              |                 |
Row 1:     NorbertAPI        Plugin loader       Two-zone model      New window        Right-click    Auto-save        norbert-session
(Must)     contract          + dependency        + divider +          + independent     toggle +       layout +         migration +
           definition        resolver            view assignment      layout            reorder        named presets    API validation
              |                  |                   |                   |                                                  |
Row 2:     Plugin             Disabled-dep       Floating panels     Window labels     Drag to        Built-in          Refine API
(Should)   sandboxing         warnings +         + pill minimize     + per-window       reorder        presets           based on
           + namespace        graceful degrade                       persistence                                         friction
              |                                      |
Row 3:     Plugin public     Version mismatch    Drag from sidebar
(Could)    API inter-plugin  hard failure         to zone assignment
           composition
```

---

## US-001: NorbertAPI Contract Definition

### Problem
Tomasz Kowalski is a developer who wants to extend Norbert with custom monitoring views for his team. He finds it impossible to add functionality because Norbert has no plugin API -- extending it requires modifying core source code, which is fragile and not shareable.

### Who
- Plugin developer | Building custom Norbert extensions | Needs stable, documented API to build against

### Solution
Define and implement the full NorbertAPI contract providing sandboxed access to: db (namespaced SQLite), hooks (event handler registration), ui (view registration, sidebar, status bar, settings), mcp (tool registration), events (internal event bus), config (plugin configuration), plugins (inter-plugin composition).

### Domain Examples
#### 1: Happy Path -- Tomasz registers a custom view
Tomasz implements the NorbertPlugin interface for his "team-monitor" plugin. In onLoad(api), he calls api.ui.registerView() with id "team-dashboard", label "Team Dashboard", icon, component, primaryView: true, minWidth: 300, minHeight: 200. The view appears in the sidebar and view picker immediately. He calls api.hooks.register() to process hook events into his namespaced db tables via api.db.

#### 2: Edge Case -- Plugin accesses dependency's public API
Tomasz's plugin declares norbert-session as a dependency. In onLoad, he calls api.plugins.get("norbert-session") and receives the session plugin's public API object. He calls sessionAPI.getSessionById(sessionId) to read session data without accessing norbert-session's internal database tables.

#### 3: Error/Boundary -- Plugin attempts to write to core tables
Tomasz's plugin calls api.db.execute("INSERT INTO sessions ...") targeting a core Norbert table. The call is rejected with an error: "Plugin 'team-monitor' cannot write to core table 'sessions'. Use your namespaced tables: 'plugin_team_monitor_*'."

### UAT Scenarios (BDD)
#### Scenario: Plugin registers view via api.ui.registerView()
Given Tomasz's "team-monitor" plugin implements NorbertPlugin interface
When the plugin calls api.ui.registerView() with id "team-dashboard" and primaryView: true
Then the view "team-dashboard" appears in the layout engine's view picker
And a sidebar icon for "team-monitor" appears in the sidebar
And clicking the sidebar icon assigns "team-dashboard" to the Main zone

#### Scenario: Plugin registers hook processor via api.hooks
Given Tomasz's plugin calls api.hooks.register("team-events", handleTeamEvent)
When a Claude Code hook event arrives at the HTTP receiver
Then handleTeamEvent receives the raw hook payload
And the plugin can write derived data to api.db in its namespaced tables

#### Scenario: Plugin reads dependency API via api.plugins
Given Tomasz's plugin declares norbert-session as a dependency
When the plugin calls api.plugins.get("norbert-session")
Then it receives norbert-session's public API object
And can call methods on it without accessing internal database tables

#### Scenario: Plugin sandbox prevents core table writes
Given Tomasz's plugin attempts to write to the core "sessions" table
When the write is executed via api.db
Then the write is rejected with an explicit error message
And Norbert's core data remains unmodified

#### Scenario: Plugin registers status bar item
Given Tomasz's plugin calls api.ui.registerStatusItem() with position "left"
When the status bar renders
Then the plugin's status item appears after core Norbert items
And the plugin can update it dynamically via api.ui.setStatusItem()

### Acceptance Criteria
- [ ] NorbertAPI provides db, hooks, ui, mcp, events, config, plugins sub-APIs
- [ ] Plugin db access is scoped to plugin's namespace; core tables are read-only
- [ ] Registered views appear in view picker and are assignable to any zone
- [ ] Registered hook processors receive all matching hook events
- [ ] Plugin sandbox prevents writes to core tables, hook config, OS keychain, and filesystem outside plugin directory
- [ ] api.plugins.get() returns dependency's public API for declared dependencies only

### Technical Notes
- NorbertPlugin interface: manifest (id, name, version, norbert_api, dependencies), onLoad(api), onUnload()
- Plugin packages are Node.js modules scanned at startup
- Sandboxing enforced at api.db layer, not at filesystem level

### Dependencies
- None (foundational story)

### Job Traceability
- JS-05: Build a Plugin Against a Stable API
- JS-06: Validate API Through First-Party Plugin Migration

### MoSCoW: Must Have
### Effort: 3 days
### Scenarios: 5

---

## US-002: Plugin Loader and Dependency Resolver

### Problem
Reina Vasquez is a power user who has installed several Norbert plugins. She finds it confusing when a plugin silently fails because a dependency is missing -- she does not know why features are unavailable or what to install to fix it.

### Who
- Power user | Multiple plugins installed | Needs clear feedback about plugin health and dependency status

### Solution
Implement plugin loader that scans for installed plugins at startup, resolves dependency graph, loads plugins in dependency order, and provides clear, actionable feedback for missing dependencies, disabled dependencies, and version mismatches.

### Domain Examples
#### 1: Happy Path -- All dependencies satisfied
Reina has norbert-session and norbert-usage installed. norbert-usage declares norbert-session as a dependency. On startup, the loader resolves the graph, loads norbert-session first, then norbert-usage. Both register their views. Startup log shows: "2 plugins loaded, 5 views registered."

#### 2: Edge Case -- Dependency installed but disabled
Reina has norbert-usage and norbert-notif installed. She previously disabled norbert-notif. On startup, norbert-usage loads successfully but shows a notification: "norbert-notif is disabled. Notification delivery will not be available. [Re-enable norbert-notif] [Dismiss] [Don't show again]." Features depending on norbert-notif show greyed-out placeholders with one-click re-enable.

#### 3: Error/Boundary -- Missing dependency with install offer
Reina installs norbert-cc-plugin-nwave, which depends on norbert-agents and norbert-archaeology (neither installed). The loader shows: "norbert-cc-plugin-nwave requires: norbert-agents (not installed), norbert-archaeology (not installed). Install missing dependencies automatically? [Yes] [No] [Show Details]."

#### 4: Error/Boundary -- Version mismatch hard failure
norbert-cc-plugin-nwave requires norbert-agents@>=1.2 but Reina has norbert-agents@1.0.0 installed. The loader refuses to load nWave and shows: "Requires norbert-agents@>=1.2 but v1.0.0 is installed. Update norbert-agents to continue."

### UAT Scenarios (BDD)
#### Scenario: Plugins load in dependency order
Given norbert-usage depends on norbert-session
And both plugins are installed
When Norbert starts up
Then norbert-session loads before norbert-usage
And both register their views successfully

#### Scenario: Disabled dependency triggers degradation warning
Given norbert-usage depends on norbert-notif
And norbert-notif is installed but disabled by Reina Vasquez
When Norbert starts up
Then norbert-usage loads successfully
And a notification states: "norbert-notif is disabled. Notification delivery will not be available."
And the notification includes a "Re-enable norbert-notif" action
And norbert-usage features depending on norbert-notif show greyed-out placeholders

#### Scenario: Missing dependency prevents load with install offer
Given norbert-cc-plugin-nwave depends on norbert-agents
And norbert-agents is not installed
When Norbert starts up
Then norbert-cc-plugin-nwave fails to load
And an error dialog lists missing dependencies with "Install Missing" action

#### Scenario: Version mismatch is a hard failure
Given norbert-cc-plugin-nwave requires norbert-agents@>=1.2
And norbert-agents@1.0.0 is installed
When Norbert starts up
Then norbert-cc-plugin-nwave refuses to load
And the error specifies the required version and how to update

#### Scenario: Runtime dependency disable triggers graceful degradation
Given norbert-usage is running and depends on norbert-notif
When Reina disables norbert-notif from the Plugin settings mid-session
Then norbert-usage features relying on norbert-notif show greyed-out placeholders
And a tray notification informs Reina what changed

### Acceptance Criteria
- [ ] Plugins load in topological dependency order
- [ ] Missing dependencies prevent load with actionable error listing what is missing
- [ ] Disabled dependencies trigger per-feature degradation warnings with re-enable action
- [ ] Version mismatches are hard failures with specific version requirement in error message
- [ ] Runtime dependency disable triggers graceful degradation without crash
- [ ] Greyed-out placeholders for suppressed features include one-click path to re-enable

### Technical Notes
- Dependency graph resolved via topological sort
- Version matching uses semver range comparison
- Disabled plugins stored in ~/.norbert/plugins.json or equivalent config

### Dependencies
- US-001 (NorbertAPI contract must exist for plugins to load against)

### Job Traceability
- JS-05: Build a Plugin Against a Stable API
- JS-06: Validate API Through First-Party Plugin Migration

### MoSCoW: Must Have
### Effort: 2 days
### Scenarios: 5

---

## US-003: Two-Zone Layout Engine with Draggable Divider

### Problem
Kai Nakamura is a developer who monitors Claude Code sessions daily. He finds it frustrating that Norbert's Phase 2 single-pane view forces him to click between session list and event detail repeatedly -- he cannot see both simultaneously and loses track of which session had the anomaly he noticed moments ago.

### Who
- Daily observer | Single monitor | Needs side-by-side view without disrupting primary content
- Power user | Dual monitor | Needs flexible split to see more data simultaneously

### Solution
Implement a two-zone layout model (Main + optional Secondary) with a draggable divider. Main is always present. Secondary is toggleable. Zones are named, keyed, and count-agnostic so future zones can be added without changing the plugin API.

### Domain Examples
#### 1: Happy Path -- Kai opens Secondary to see session list alongside events
Kai has Session Detail in Main. He presses Ctrl+Shift+\ to show the Secondary zone. A view picker opens (no previous assignment). He selects "Session List." Now Session List is in Secondary (40% width) and Session Detail in Main (60% width). He can see active sessions while reading event details.

#### 2: Edge Case -- Divider at minimum width boundary
Reina drags the divider far to the right. The Secondary zone reaches 280px minimum width and stops shrinking. The divider cannot be dragged further. Releasing the divider at this position saves the percentage to layout.json.

#### 3: Error/Boundary -- Toggle Secondary with nothing assigned
Kai presses Ctrl+Shift+\ to show Secondary when no view was previously assigned. The Secondary zone opens showing an empty state: "No view assigned. Click here or use Ctrl+Shift+P to assign a view." This is guidance, not an error.

### UAT Scenarios (BDD)
#### Scenario: Open Secondary zone with view assignment
Given Kai Nakamura has Session Detail in the Main zone
And the Secondary zone is hidden
When Kai presses Ctrl+Shift+\
And the view picker opens
And Kai selects "Session List" from norbert-session
Then Session List appears in the Secondary zone
And Main remains showing Session Detail undisturbed
And a draggable divider separates the two zones

#### Scenario: Drag divider to resize zones
Given Reina Vasquez has Main at 50% and Secondary at 50%
When Reina drags the divider 100px to the right
Then Main zone widens and Secondary zone narrows
And neither zone goes below 280px minimum width
And the new position is auto-saved to layout.json as a percentage

#### Scenario: Double-click divider to snap 50/50
Given Main is at 70% and Secondary at 30%
When Kai double-clicks the divider handle
Then zones snap to 50% / 50%

#### Scenario: Hide Secondary zone collapses to full-width Main
Given Main and Secondary are visible
When Kai presses Ctrl+Shift+\ to hide Secondary
Then Secondary hides and Main expands to full content width
And the view that was in Secondary is unloaded

#### Scenario: Reshow Secondary restores last-used view
Given Kai previously had Session List in Secondary
And Kai hid the Secondary zone
When Kai presses Ctrl+Shift+\ again
Then Secondary reappears with Session List loaded

### Acceptance Criteria
- [ ] Main zone is always present and cannot be hidden
- [ ] Secondary zone is optional, toggleable via Ctrl+Shift+\ and UI toggle
- [ ] Draggable 4px divider between zones with double-click snap to 50/50
- [ ] Minimum zone width 280px enforced
- [ ] Divider position saved as percentage in layout.json
- [ ] Zones are stored as keyed map in layout.json, not positional fields
- [ ] Zone abstraction does not assume exactly two zones (count-agnostic)

### Technical Notes
- Zone registry is a Map<string, ZoneConfig> with named entries
- Divider position stored as ratio (0.0-1.0) for resolution independence
- Minimum width constraint enforced at render time, not at persistence time

### Dependencies
- US-001 (plugins register views that populate zones)

### Job Traceability
- JS-01: Arrange My Workspace for the Task at Hand

### MoSCoW: Must Have
### Effort: 3 days
### Scenarios: 5

---

## US-004: View Assignment via Right-Click, Drag, and Picker

### Problem
Reina Vasquez is a power user who arranges her Norbert workspace differently depending on whether she is monitoring live sessions, reviewing costs, or debugging. She finds it slow to navigate through menus every time she wants to move a view to a different zone -- she wants multiple fast paths that match her current hand position (mouse or keyboard).

### Who
- Power user | Frequent layout changes | Needs fast, multiple paths to assign views to zones

### Solution
Implement four view assignment mechanisms: (1) right-click context menu on sidebar icons and view elements, (2) drag sidebar icon into target zone, (3) searchable view picker via Ctrl+Shift+P, (4) layout preset application. All four produce identical zone state.

### Domain Examples
#### 1: Happy Path -- Reina right-clicks to assign view to Secondary
Reina right-clicks the Sessions sidebar icon. Context menu shows: "Open in Main Panel", "Open in Secondary Panel", "Open in New Window", "Open as Floating Panel." She selects "Open in Secondary Panel." Session List replaces whatever was in Secondary.

#### 2: Edge Case -- Drag sidebar icon to zone with branded drop overlay
Reina drags the Sessions icon toward the Secondary zone. As her cursor enters the zone, a branded overlay appears: "Assign to Secondary." She drops. Session List (primaryView) replaces the previous Secondary content. The overlay disappears.

#### 3: Error/Boundary -- Drag to invalid drop area has no effect
Reina drags a sidebar icon but drops it outside any zone or floating panel area. Nothing happens. The previous layout is unchanged. No error message needed -- the action simply did not complete.

### UAT Scenarios (BDD)
#### Scenario: Right-click context menu assigns view to Secondary
Given Reina Vasquez has Norbert open with Session Detail in Main
When Reina right-clicks the Sessions sidebar icon
And selects "Open in Secondary Panel"
Then Session List appears in the Secondary zone
And Main zone content is undisturbed

#### Scenario: Drag sidebar icon to zone with visual feedback
Given Reina has Main and Secondary zones visible
When Reina drags the Sessions icon over the Secondary zone
Then a branded drop overlay appears on the Secondary zone
When Reina drops the icon
Then Session List replaces the Secondary zone content
And the drop overlay disappears

#### Scenario: View picker assigns view via keyboard
Given Kai Nakamura presses Ctrl+Shift+P
And types "Change Main View"
When the view picker shows all registered views grouped by plugin
And Kai selects "norbert-session > Session List"
Then Session List is assigned to the Main zone

#### Scenario: All assignment mechanisms produce identical state
Given Reina assigns Session List to Main via right-click
And saves layout.json
Then assigns Session List to Main via drag-and-drop on a fresh layout
And saves layout.json
Then both layout.json files have identical zone assignment entries

#### Scenario: Assigning a view replaces current occupant
Given Session Detail occupies the Main zone
When Reina assigns Session List to Main via any mechanism
Then Session Detail is unloaded from Main
And Session List occupies Main
And Session Detail can be reassigned to any zone

### Acceptance Criteria
- [ ] Right-click context menu on sidebar icons offers: Open in Main, Secondary, New Window, Floating Panel
- [ ] Drag from sidebar to zone shows branded drop overlay and assigns primaryView on drop
- [ ] View picker (Ctrl+Shift+P) shows searchable list of all registered views grouped by plugin
- [ ] All four assignment mechanisms produce identical layout.json state
- [ ] Assigning a view replaces current zone occupant (no stacking)

### Technical Notes
- Right-click menu items generated from zone registry (not hardcoded to Main/Secondary)
- Drag-and-drop uses HTML5 drag API with custom ghost showing plugin icon
- View picker reuses command palette component

### Dependencies
- US-003 (zones must exist to assign views to)
- US-001 (views must be registered via plugin API)

### Job Traceability
- JS-01: Arrange My Workspace for the Task at Hand

### MoSCoW: Must Have
### Effort: 2 days
### Scenarios: 5

---

## US-005: Floating Panel with Pill Minimize

### Problem
Kai Nakamura wants to keep a small cost ticker or session count visible while his Main zone shows the full session detail view. He finds it wasteful to dedicate the entire Secondary zone to a small metric -- he wants a small, repositionable overlay that stays out of the way.

### Who
- Daily observer | Single monitor | Needs ambient info without consuming zone space

### Solution
Any registered view can be opened as a floating panel -- a resizable, repositionable glass overlay above the layout. Floating panels can minimize to a pill showing view name and live metric. Multiple floats can be open simultaneously.

### Domain Examples
#### 1: Happy Path -- Kai opens Session List as floating panel
Kai right-clicks the Sessions sidebar icon and selects "Open as Floating Panel." A glass panel appears overlaying the Main zone, showing Session List. It is resizable by dragging edges. Kai repositions it to the bottom-right corner where it snaps to the window edge.

#### 2: Edge Case -- Minimized pill shows live metric
Kai minimizes the floating Session List panel. The panel collapses to a small pill in the corner: "Sessions  3" (3 active sessions, from floatMetric: "active_session_count"). When a new session starts, the pill updates to "Sessions  4" without user action.

#### 3: Error/Boundary -- View with no floatMetric minimizes without metric
Kai opens a view that did not declare a floatMetric. When he minimizes it, the pill shows only the view name: "Session Detail" with no metric number.

### UAT Scenarios (BDD)
#### Scenario: Open view as floating panel
Given Kai Nakamura has Session Detail in Main zone
When Kai right-clicks the Sessions sidebar icon
And selects "Open as Floating Panel"
Then a floating panel appears overlaying the content area
And the panel shows Session List
And the panel is resizable by dragging edges or corners
And the panel is repositionable by dragging the header bar

#### Scenario: Floating panel snaps to window edges
Given Kai is dragging a floating panel
When the panel's edge comes within 20px of the window edge
Then the panel snaps to the window edge

#### Scenario: Minimize to pill with live metric
Given Kai has a floating Session List panel open
And norbert-session declares floatMetric "active_session_count"
And there are 3 active sessions
When Kai minimizes the panel
Then a pill appears: "Sessions  3"
When a 4th session starts
Then the pill updates to "Sessions  4"

#### Scenario: Floating panel Switch Mode via menu
Given Kai has a floating panel showing Session List
When Kai clicks the "..." menu on the panel header
And selects "Switch Mode"
Then a popover lists norbert-session's views in tab order
When Kai selects "Session Detail"
Then the panel content switches to Session Detail

#### Scenario: Floating panel position persists
Given Kai has positioned a floating panel at bottom-right corner
When Kai restarts Norbert
Then the floating panel reappears at the same position and size
And the same view is loaded

### Acceptance Criteria
- [ ] Any registered view can be opened as a floating panel
- [ ] Floating panels are resizable, repositionable, and snap to window edges
- [ ] Minimize collapses to pill showing view name and floatMetric value (if declared)
- [ ] Pill updates live as metric changes
- [ ] "..." menu provides: Switch Mode, Open in Main/Secondary, Open in New Window, Minimize, Close
- [ ] Floating panel position and size persisted in layout.json per view
- [ ] Multiple floating panels can be open simultaneously

### Technical Notes
- Floating panels do not inherit zone toolbar; plugin tab sequence accessible via "..." menu only
- Pill click restores panel to previous size and position
- Panels rendered as z-indexed overlay, not in zone flow

### Dependencies
- US-001 (views registered via plugin API)
- US-003 (layout engine manages floating panel state)

### Job Traceability
- JS-01: Arrange My Workspace for the Task at Hand

### MoSCoW: Should Have
### Effort: 2 days
### Scenarios: 5

---

## US-006: Multi-Window with Independent Layouts

### Problem
Reina Vasquez runs 3-4 Claude Code sessions across repos on a dual-monitor setup. She finds it insufficient to monitor all sessions in a single window -- she wants a dedicated monitoring window on her second monitor while keeping cost and config views on her primary monitor, both updating live.

### Who
- Power user | Dual monitor, multiple sessions | Needs independent windows sharing the same data

### Solution
Support multiple independent Norbert windows. Single backend process. Each window is a pure UI shell subscribing to backend events via Tauri IPC. Per-window layout persistence. Window labelling.

### Domain Examples
#### 1: Happy Path -- Reina opens a second window for her second monitor
Reina right-clicks the Sessions sidebar icon and selects "Open in New Window." A new window opens showing Session List in Main. She drags it to her second monitor and labels it "Monitor 2 - Sessions." Both windows update live when hook events arrive.

#### 2: Edge Case -- Window label appears in title bar and status bar
Reina labels Window 2 as "Monitor 2 - Sessions" via right-click on the title bar. The title bar shows "Norbert - Monitor 2 - Sessions." The status bar right-aligned area shows "Monitor 2 - Sessions" dimly.

#### 3: Error/Boundary -- Both windows open on restart
Reina had two windows open when she quit Norbert. On next launch, both windows reopen at their previous positions with their saved layouts. Window 1 has Session List + Session Detail. Window 2 has Session List (full width) with label "Monitor 2."

### UAT Scenarios (BDD)
#### Scenario: Open new window via right-click
Given Reina Vasquez has Norbert open on her primary monitor
When Reina right-clicks the Sessions sidebar icon
And selects "Open in New Window"
Then a new Norbert window opens
And the new window shows Session List in Main
And both windows receive live hook event updates

#### Scenario: Two windows with independent layouts
Given Reina has two windows open
And Window 1 shows Session List in Main, Session Detail in Secondary
And Window 2 shows Session List in Main (full width)
When Reina changes Window 2's Main view to a different plugin
Then Window 1's layout is completely unaffected

#### Scenario: Per-window layout persistence across restart
Given Reina has two windows with different layouts
When Reina quits and relaunches Norbert
Then both windows reopen
And each has its saved layout restored

#### Scenario: Label a window
Given Reina has a second window open
When Reina right-clicks Window 2's title bar
And selects "Label This Window"
And types "Monitor 2 - Sessions"
Then the title bar shows "Norbert - Monitor 2 - Sessions"
And the status bar shows the label

#### Scenario: Closing one window does not affect others
Given Reina has two windows open
When Reina closes Window 2
Then Window 1 continues normally
And the backend process remains alive

### Acceptance Criteria
- [ ] Multiple windows open simultaneously with independent layouts
- [ ] Single backend process regardless of window count
- [ ] Each window subscribes to backend events via Tauri IPC independently
- [ ] Per-window layout persisted as ~/.norbert/layout-{window-id}.json
- [ ] All open windows reopen on next launch with saved layouts
- [ ] Windows can be labeled via title bar right-click or command palette
- [ ] Closing one window does not affect others; last window closing keeps backend in tray mode

### Technical Notes
- Architecture mirrors VS Code: one main process (Rust/Node), multiple renderer processes (webview)
- Read queries go directly to SQLite (WAL mode, concurrent reads safe)
- Write operations routed through backend to serialize safely
- New window entry points: right-click > New Window, Ctrl+Shift+N, tray menu, command palette

### Dependencies
- US-003 (layout engine per window)
- US-004 (view assignment per window)

### Job Traceability
- JS-03: Monitor Multiple Concerns Across Windows

### MoSCoW: Must Have
### Effort: 3 days
### Scenarios: 5

---

## US-007: Sidebar Icon Visibility and Reorder

### Problem
Kai Nakamura has several plugins installed but only actively uses Sessions and Config daily. He finds the sidebar cluttered with icons for Agents, Tools, Debug, and other plugins he rarely opens -- the visual noise makes it slower to find the sections he actually uses.

### Who
- Daily observer | Several plugins installed | Needs curated sidebar matching daily workflow

### Solution
Implement right-click context menu on sidebar icons with full toggle list (checkmarks for visible, click to show/hide). Support drag-to-reorder. Persist visibility and order in ~/.norbert/sidebar.json. Hidden sections remain accessible via command palette.

### Domain Examples
#### 1: Happy Path -- Kai hides Agents and reorders Sessions first
Kai right-clicks the Agents icon. The context menu shows all sections with checkmarks. He unchecks Agents -- the icon disappears. Then he drags Sessions above Dashboard. His sidebar now shows Sessions, Dashboard, Config (his daily three) with the rest hidden. State saves to sidebar.json.

#### 2: Edge Case -- Hidden section accessed via command palette
Kai has hidden Agents. He presses Ctrl+Shift+P, types "Open Agents." The Agents view opens in Main zone. The Agents sidebar icon remains hidden -- command palette access does not change visibility settings.

#### 3: Error/Boundary -- Reset sidebar restores defaults
Kai has hidden 4 icons and reordered the rest. He right-clicks and selects "Reset Sidebar." All icons return to default order and visibility. sidebar.json is updated.

### UAT Scenarios (BDD)
#### Scenario: Toggle sidebar icon visibility via right-click
Given Kai Nakamura has all default sidebar icons visible
When Kai right-clicks the Agents sidebar icon
And unchecks "Agents" in the toggle list
Then the Agents icon disappears from the sidebar
And sidebar.json is updated to reflect the change

#### Scenario: Drag sidebar icons to reorder
Given Kai wants Sessions first in the sidebar
When Kai drags the Sessions icon above Dashboard
Then Sessions appears first in the sidebar
And sidebar.json records the new order

#### Scenario: Hidden section accessible via command palette
Given Kai has hidden the Agents sidebar icon
When Kai presses Ctrl+Shift+P and types "Open Agents"
Then the Agents view opens in Main zone
And the Agents sidebar icon remains hidden

#### Scenario: Reset sidebar to defaults
Given Kai has customized sidebar visibility and order
When Kai right-clicks any icon and selects "Reset Sidebar"
Then all icons return to default visibility and order

#### Scenario: New plugin appears at end of sidebar
Given Kai has a customized sidebar order
When norbert-usage plugin is newly installed
Then its icon appears at the end of the sidebar (before bottom-pinned items)
And existing order is not disrupted

### Acceptance Criteria
- [ ] Right-click on any sidebar icon shows full section toggle list with checkmarks
- [ ] Clicking a section name in the toggle list shows/hides its icon
- [ ] Drag-to-reorder works for both core sections and plugin sections
- [ ] Sidebar state persisted in ~/.norbert/sidebar.json
- [ ] Hidden sections accessible via Ctrl+Shift+P command palette
- [ ] "Reset Sidebar" restores default visibility and order
- [ ] Newly installed plugins append to end without disrupting existing order

### Technical Notes
- sidebar.json schema: ordered array of { id, visible } entries
- Separator between core and plugin sections also draggable
- Bottom-pinned items (Notifications, Settings) always remain at bottom

### Dependencies
- US-001 (plugins register sidebar tabs via api.ui.registerTab())

### Job Traceability
- JS-04: Customize Which Sidebar Icons Are Visible

### MoSCoW: Must Have
### Effort: 1 day
### Scenarios: 5

---

## US-008: Layout Persistence and Named Presets

### Problem
Reina Vasquez arranges her Norbert workspace differently for monitoring (sessions + live viz) vs cost review (usage analytics + session list) vs debugging (session detail + events). She finds it tedious to rearrange her layout every time she switches tasks -- she wants to save and recall named configurations instantly.

### Who
- Power user | Frequent task-switching | Needs instant layout switching for different workflows

### Solution
Auto-save layout state on every change. Named layout presets with save/recall via Ctrl+Shift+L. Built-in presets (Default, Session Watch, etc.) that cannot be deleted. Custom presets that can be created, renamed, and deleted. "Reset to Default" escape hatch.

### Domain Examples
#### 1: Happy Path -- Reina saves "Cost Review" preset
Reina arranges Usage Analytics in Main and Session List in Secondary at 60/40 split. She presses Ctrl+Shift+L, selects "Save Current Layout As...", types "Cost Review." The preset appears in the Layout Picker. Tomorrow she presses Ctrl+Shift+L, selects "Cost Review," and the layout restores instantly.

#### 2: Edge Case -- Built-in preset cannot be deleted
Reina opens the Layout Picker and right-clicks "Default." There is no Delete option. "Save Copy As..." is available. She creates "My Default" which she can modify and delete freely.

#### 3: Error/Boundary -- Preset references uninstalled plugin
Reina saved a preset "nWave Debug" that assigns nwave-wave-flow to Main. She later uninstalls the nWave plugin. When she selects "nWave Debug" from the Layout Picker, Main shows an empty state: "View 'nwave-wave-flow' is no longer available." Secondary zone (if assigned to an available view) loads normally.

### UAT Scenarios (BDD)
#### Scenario: Auto-save layout on every change
Given Reina Vasquez drags the divider to 65% position
Then layout.json is updated within 1 second
And no manual save action is required

#### Scenario: Save named layout preset
Given Reina has arranged her preferred monitoring layout
When Reina presses Ctrl+Shift+L
And selects "Save Current Layout As..."
And types "Monitoring"
Then the preset "Monitoring" is saved
And it appears in the Layout Picker

#### Scenario: Switch between presets
Given Reina has "Monitoring" and "Cost Review" presets saved
When Reina presses Ctrl+Shift+L and selects "Cost Review"
Then the layout changes to match the "Cost Review" preset

#### Scenario: Built-in presets cannot be deleted
Given Reina opens the Layout Picker
When she right-clicks the "Default" preset
Then no Delete option is shown
And "Save Copy As..." is available

#### Scenario: Reset to Default layout
Given Reina has a complex multi-zone layout with floating panels
When she selects "Reset to Default" from the Layout Picker
Then the layout resets to single Main zone with the first available primaryView
And Secondary zone is hidden and all floating panels are closed

### Acceptance Criteria
- [ ] Layout auto-saves on every change (zone assignment, divider, floating panel position)
- [ ] Named presets saved/recalled via Ctrl+Shift+L Layout Picker
- [ ] Built-in presets (Default, Session Watch, Cost Monitor) present and not deletable
- [ ] Custom presets can be created, renamed, and deleted
- [ ] "Reset to Default" restores single Main zone with primaryView
- [ ] Presets store zone assignments as keyed map (future-proof for N zones)
- [ ] Preset referencing uninstalled plugin view shows graceful empty state per zone

### Technical Notes
- Presets stored in layout.json under "presets" key
- Layout Picker is command-palette-style UI opened via Ctrl+Shift+L
- Built-in presets reference standard plugin view IDs (norbert-session, norbert-usage)

### Dependencies
- US-003 (layout engine state to persist)
- US-004 (view assignments to include in presets)
- US-005 (floating panel state to include in presets)

### Job Traceability
- JS-02: Persist My Layout Across Restarts

### MoSCoW: Must Have
### Effort: 2 days
### Scenarios: 5

---

## US-009: norbert-session Plugin Migration and API Validation

### Problem
The Norbert development team needs to validate that the plugin API and layout engine are sufficient for real-world plugin development before external developers build against them. The existing Phase 2 session list feature is hardcoded into Norbert core, proving nothing about plugin API quality.

### Who
- Norbert development team | Building first first-party plugin | Needs to validate API completeness and ergonomics

### Solution
Migrate the Phase 2 session list feature into norbert-session, the first first-party plugin, built entirely against the public plugin API. Validate that the view is assignable to any zone, floating panel, and new window. Refine the API based on friction encountered during migration.

### Domain Examples
#### 1: Happy Path -- norbert-session registers and works in Main zone
norbert-session implements NorbertPlugin, registers "session-list" view via api.ui.registerView() with primaryView: true. On startup, clicking the Sessions sidebar icon assigns Session List to Main zone. The view displays active sessions with live updates.

#### 2: Edge Case -- Session List works in floating panel with live metric
norbert-session declares floatMetric: "active_session_count" on its session-list view. When opened as a floating panel and minimized, the pill shows "Sessions  3" and updates live as sessions start and end.

#### 3: Error/Boundary -- Session List works in new window
Kai right-clicks the Sessions sidebar icon and selects "Open in New Window." A new window opens with Session List in Main. Both the original window and new window show the same session data, updating live independently.

### UAT Scenarios (BDD)
#### Scenario: norbert-session registers views via plugin API
Given norbert-session implements NorbertPlugin interface
When it calls api.ui.registerView() with "session-list" as primaryView
Then Session List appears in the view picker
And the Sessions sidebar icon appears
And clicking the icon assigns Session List to Main zone

#### Scenario: Session List assignable to all placement targets
Given norbert-session is loaded
Then Session List can be assigned to Main zone via sidebar click
And to Secondary zone via right-click menu
And opened as floating panel via right-click menu
And opened in a new window via right-click menu
And assigned via drag-and-drop to any zone
And assigned via view picker

#### Scenario: Session List persists across restart
Given Kai has Session List in Main zone
When Kai restarts Norbert
Then Session List appears in Main zone after restart
And the same session data is visible

#### Scenario: Session List in floating panel shows live metric
Given Session List is open as a floating panel
And floatMetric is "active_session_count"
And there are 2 active sessions
When Kai minimizes the panel
Then the pill shows "Sessions  2"
When a third session starts
Then the pill updates to "Sessions  3"

#### Scenario: API friction points documented for refinement
Given norbert-session development is complete
When the team reviews the development experience
Then any API methods that were awkward, missing, or overly complex are documented
And API refinements are applied before Phase 4 plugin development begins

### Acceptance Criteria
- [ ] norbert-session is a standalone plugin using only the public NorbertPlugin interface
- [ ] Session List view registered via api.ui.registerView() with primaryView: true
- [ ] View assignable to Main zone, Secondary zone, floating panel, and new window
- [ ] All Phase 2 session list functionality preserved (no regression)
- [ ] floatMetric updates live in minimized pill
- [ ] Layout persistence works for norbert-session view across restarts
- [ ] API friction log produced with refinements applied

### Technical Notes
- norbert-session is bundled with Norbert core (first-party) but loaded via plugin loader like any plugin
- Must not use any internal Norbert APIs -- only the public NorbertAPI contract
- Friction log feeds back into US-001 refinements

### Dependencies
- US-001 (NorbertAPI contract)
- US-002 (plugin loader)
- US-003 (layout engine zones)
- US-004 (view assignment)
- US-005 (floating panels)
- US-006 (multi-window)

### Job Traceability
- JS-06: Validate API Through First-Party Plugin Migration

### MoSCoW: Must Have
### Effort: 3 days
### Scenarios: 5

---

## Story Dependency Graph

```
US-001 (NorbertAPI Contract)
  |
  ├── US-002 (Plugin Loader + Dependency Resolver)
  |
  ├── US-003 (Two-Zone Layout Engine)
  |     |
  |     ├── US-004 (View Assignment Mechanisms)
  |     |
  |     ├── US-005 (Floating Panels)
  |     |
  |     └── US-006 (Multi-Window)
  |
  ├── US-007 (Sidebar Customization)
  |
  └── US-008 (Layout Persistence + Presets)
        |
        └── US-009 (norbert-session Migration + Validation)
              (depends on all of the above)
```

## MoSCoW Summary

| Story | Priority | Effort | Scenarios |
|-------|----------|--------|-----------|
| US-001: NorbertAPI Contract | Must | 3 days | 5 |
| US-002: Plugin Loader | Must | 2 days | 5 |
| US-003: Two-Zone Layout | Must | 3 days | 5 |
| US-004: View Assignment | Must | 2 days | 5 |
| US-005: Floating Panels | Should | 2 days | 5 |
| US-006: Multi-Window | Must | 3 days | 5 |
| US-007: Sidebar Customize | Must | 1 day | 5 |
| US-008: Layout Presets | Must | 2 days | 5 |
| US-009: norbert-session | Must | 3 days | 5 |
| **Total** | | **21 days** | **45** |
