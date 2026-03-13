# JTBD Analysis: Plugin Architecture and Layout Engine (Phase 3)

## Job Classification

**Job Type**: Brownfield Feature Development (Job 2)
**Rationale**: Existing Norbert app (Phase 0-2 complete) with known problem domain. Phase 3 introduces structural capabilities (plugin system, layout engine, multi-window) that make every subsequent feature faster. This is a platform investment, not greenfield.

**Workflow**: `[research] -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review`
**Note**: Discovery phase included despite brownfield because the plugin API contract and layout engine are new capabilities requiring requirements elicitation from the product spec.

---

## Personas

### P1: Kai Nakamura — The Daily Observer
- **Role**: Senior developer using Claude Code daily for feature work
- **Context**: Single monitor, one Claude Code session at a time, wants quick glance at what the agent is doing
- **Motivation**: Ambient awareness without disrupting flow
- **Current state**: Phase 2 Norbert shows sessions and events in a fixed single-pane view
- **Pain**: Cannot see session list and event detail simultaneously; window is one-thing-at-a-time

### P2: Reina Vasquez — The Multi-Session Power User
- **Role**: Tech lead running 3-4 Claude Code sessions across repos simultaneously
- **Context**: Dual monitor setup, wants dedicated monitoring on second screen
- **Motivation**: Parallel visibility into multiple sessions without tab-switching
- **Current state**: Must click between sessions in single view, losing context on active sessions
- **Pain**: Context switching overhead when monitoring parallel work; cannot dedicate a window per concern

### P3: Tomasz Kowalski — The Future Plugin Developer
- **Role**: Developer building a custom Norbert plugin for their team's internal tooling
- **Context**: Wants to register views, process hook events, and integrate with Norbert's layout system
- **Motivation**: Extend Norbert without forking; publish reusable plugin for team
- **Current state**: No plugin API exists yet; features are hardcoded into the Norbert core
- **Pain**: Cannot extend Norbert; any customization requires modifying core source

---

## Job Stories

### JS-01: Arrange My Workspace for the Task at Hand

**When** I am monitoring a Claude Code session and need to reference additional information (session list, event detail, cost tracker) alongside the main view,
**I want to** arrange my workspace with multiple views visible simultaneously,
**so I can** observe what I need without losing sight of what matters most.

#### Functional Job
Assign views to zones (Main, Secondary, floating panel) and resize them to fit the current monitoring task.

#### Emotional Job
Feel in control of my workspace -- the tool adapts to my workflow, not the other way around.

#### Social Job
Be seen as an efficient developer whose monitoring setup enables quick, informed decisions.

#### Forces Analysis

| Force | Description |
|-------|-------------|
| **Push** | Phase 2 single-pane view forces constant click-switching between session list and event detail. Reina loses track of which session had the anomaly she noticed 30 seconds ago. |
| **Pull** | Side-by-side layout where session list stays visible while events stream in Main. Drag-and-drop to rearrange. Floating cost ticker always visible without consuming zone space. |
| **Anxiety** | "What if the layout is too complex to set up? I just want to glance at things." / "Will the divider be fiddly? I don't want to spend time arranging panels." |
| **Habit** | Accustomed to VS Code's panel arrangement. Expect familiar keyboard shortcuts (Ctrl+B for sidebar, Ctrl+Shift+P for command palette). |

**Switch likelihood**: High -- Push is strong (current single-pane is a real daily friction) and Pull is attractive (VS Code-familiar layout).
**Key blocker**: Anxiety about complexity. Must feel effortless for Kai's single-zone default, powerful for Reina's multi-zone arrangement.
**Design implication**: Default to single-zone simplicity. Secondary zone and floating panels are opt-in, discoverable but not forced.

---

### JS-02: Persist My Layout Across Restarts

**When** I have arranged my Norbert workspace to match my monitoring workflow (which view in Main, which in Secondary, divider position, floating panels),
**I want to** have that arrangement restore exactly on next launch,
**so I can** sit down and start monitoring immediately without rebuilding my workspace every morning.

#### Functional Job
Save and restore layout state (zone assignments, divider positions, floating panel positions/sizes) automatically.

#### Emotional Job
Feel that Norbert remembers me -- the tool is ready when I am.

#### Social Job
Not relevant for this job.

#### Forces Analysis

| Force | Description |
|-------|-------------|
| **Push** | Every restart of current Phase 2 app resets to default view. Reina re-navigates to her preferred session every time. |
| **Pull** | Open Norbert, see exactly what was there when it closed. Named presets for different workflows (monitoring vs debugging vs cost review). |
| **Anxiety** | "What if the saved layout gets corrupted and I can't get back to default?" |
| **Habit** | VS Code restores window layout on restart. Expect the same behavior. |

**Switch likelihood**: High -- expectation set by VS Code.
**Key blocker**: Must have "Reset to Default" escape hatch.
**Design implication**: Auto-save on every layout change. Named presets with built-in defaults that cannot be deleted.

---

### JS-03: Monitor Multiple Concerns Across Windows

**When** I am running multiple Claude Code sessions on a dual-monitor setup and want dedicated monitoring for different concerns,
**I want to** open multiple Norbert windows, each with its own independent layout,
**so I can** watch session activity on one monitor while reviewing cost and config on another.

#### Functional Job
Open additional windows with independent zone configurations, each subscribing to the same backend data without duplication or performance loss.

#### Emotional Job
Feel that Norbert scales with my workload -- more sessions, more windows, no sluggishness.

#### Social Job
Demonstrate sophisticated monitoring capability to the team -- "look, I can see everything at once."

#### Forces Analysis

| Force | Description |
|-------|-------------|
| **Push** | Single window forces Alt-Tab between monitoring concerns. Reina wastes cognitive bandwidth switching focus. |
| **Pull** | Second monitor dedicated to live session visualizer while primary monitor shows cost and config. Both windows updating live. |
| **Anxiety** | "Will two windows make the app slow? Will they fight over data?" / "What happens if I close the wrong window?" |
| **Habit** | VS Code multi-window is familiar. Expect same independence. |

**Switch likelihood**: High for power users (Reina). Low priority for single-session users (Kai).
**Key blocker**: Performance anxiety. Must demonstrate zero degradation with two windows.
**Design implication**: Single backend process. Windows are pure UI shells subscribing via IPC. Opening a window adds render cost, not backend cost.

---

### JS-04: Customize Which Sidebar Icons Are Visible

**When** I have loaded several plugins but only actively use 3-4 of them daily,
**I want to** hide sidebar icons I don't need and reorder the ones I keep,
**so I can** navigate quickly to the sections that matter without visual clutter.

#### Functional Job
Toggle visibility and drag-to-reorder sidebar icons. Persist preferences across restarts.

#### Emotional Job
Feel that the sidebar is mine -- curated to my workflow, not a dumping ground for every installed plugin.

#### Social Job
Not relevant.

#### Forces Analysis

| Force | Description |
|-------|-------------|
| **Push** | As more plugins install, sidebar grows cluttered. Icons for rarely-used features dilute the useful ones. |
| **Pull** | Right-click any icon to see full toggle list. Drag to reorder. Hidden sections still reachable via Ctrl+Shift+P. |
| **Anxiety** | "What if I hide something and can't find it again?" |
| **Habit** | VS Code Activity Bar right-click shows exactly this toggle list. Expect identical behavior. |

**Switch likelihood**: High once plugins exist. Low urgency in Phase 3 with only norbert-session.
**Key blocker**: Discoverability of hidden sections via command palette.
**Design implication**: Right-click context menu with full section list. "Reset Sidebar" as escape hatch.

---

### JS-05: Build a Plugin Against a Stable API

**When** I want to extend Norbert with a custom view, hook processor, or MCP tool for my team,
**I want to** build against a well-documented, stable plugin API that handles registration, lifecycle, and sandboxing,
**so I can** ship a plugin that works reliably without understanding Norbert internals.

#### Functional Job
Implement NorbertPlugin interface (manifest, onLoad, onUnload). Register views via api.ui.registerView(). Process hooks via api.hooks. Store data via api.db. Declare dependencies via manifest.

#### Emotional Job
Feel confident that the API is stable and my plugin will not break on Norbert updates.

#### Social Job
Be recognized as a contributor to the Norbert ecosystem.

#### Forces Analysis

| Force | Description |
|-------|-------------|
| **Push** | Cannot extend Norbert at all today. Custom monitoring needs require forking core. |
| **Pull** | Clean API contract: db, hooks, ui, mcp, events, config, plugins. Sandboxed. Dependency resolution with clear error messages. |
| **Anxiety** | "Will the API change and break my plugin?" / "Is the sandbox too restrictive?" / "What happens when my dependency is disabled?" |
| **Habit** | Familiar with VS Code extension API patterns. Expect similar lifecycle and registration model. |

**Switch likelihood**: High for Tomasz. Not applicable to Kai/Reina until ecosystem matures.
**Key blocker**: API stability confidence. Must feel production-grade from day one.
**Design implication**: Validate API by building norbert-session against it. If first-party plugin feels wrong, API is wrong.

---

### JS-06: Validate API Through First-Party Plugin Migration

**When** the Phase 2 session list feature needs to be migrated into the plugin architecture as norbert-session,
**I want to** build it entirely against the public plugin API (api.ui.registerView(), api.hooks, api.db),
**so I can** prove the API is sufficient and stable before external developers build against it.

#### Functional Job
Migrate existing session list into norbert-session plugin. Register its view. Assign it to any zone, floating panel, or new window via standard layout engine mechanisms.

#### Emotional Job
Feel confident that the API supports real-world plugin complexity -- not just toy examples.

#### Social Job
Demonstrate to potential plugin developers that the API is dogfooded and trustworthy.

#### Forces Analysis

| Force | Description |
|-------|-------------|
| **Push** | Hardcoded session list proves nothing about plugin API quality. Cannot validate API without a real consumer. |
| **Pull** | norbert-session as proof: assignable to any zone, works in floating panel, works in new window. If it works, the API works. |
| **Anxiety** | "What if the migration reveals the API is fundamentally wrong and we need to redesign?" |
| **Habit** | Session list already works in Phase 2. Migration introduces risk to a working feature. |

**Switch likelihood**: Mandatory -- this is the validation gate for Phase 3.
**Key blocker**: Must not regress session list functionality during migration.
**Design implication**: Build plugin API, migrate session list, test all placement mechanisms, refine API based on friction points.

---

## Opportunity Scoring

Scoring based on product spec analysis and persona needs. Source: product spec evidence + team estimate.

| # | Outcome Statement | Imp. (%) | Sat. (%) | Score | Priority |
|---|-------------------|----------|----------|-------|----------|
| 1 | Minimize the time to arrange views for the current monitoring task | 95 | 15 | 17.5 | Extremely Underserved |
| 2 | Minimize the likelihood of losing workspace arrangement on restart | 90 | 10 | 16.0 | Extremely Underserved |
| 3 | Minimize the time to assign a specific view to a specific zone | 85 | 10 | 14.5 | Underserved |
| 4 | Minimize the likelihood of performance degradation with multiple windows | 80 | 50 | 11.0 | Appropriately Served |
| 5 | Minimize the time for a plugin developer to register a view and see it in the layout | 75 | 5 | 14.5 | Underserved |
| 6 | Minimize the likelihood of a disabled dependency causing silent failures | 70 | 5 | 13.5 | Underserved |
| 7 | Minimize the time to customize sidebar icon visibility and order | 60 | 20 | 10.0 | Appropriately Served |
| 8 | Minimize the likelihood that adding a third zone in the future requires plugin API changes | 85 | 5 | 16.5 | Extremely Underserved |
| 9 | Minimize the time to switch between named layout presets | 70 | 5 | 13.5 | Underserved |
| 10 | Minimize the likelihood of data contention between multiple windows | 80 | 40 | 11.2 | Appropriately Served |

### Data Quality Notes
- Source: product spec analysis + team estimates
- Sample size: N/A (pre-launch, no user data)
- Confidence: Medium (team estimates based on VS Code user expectations)

### Top Opportunities (Score >= 12)
1. **Workspace arrangement** (17.5) -- Layout engine two-zone model with drag-and-drop
2. **Future-proof zone abstraction** (16.5) -- Count-agnostic zone model
3. **Layout persistence** (16.0) -- Auto-save and named presets
4. **View assignment speed** (14.5) -- Four assignment mechanisms (right-click, drag, picker, preset)
5. **Plugin view registration speed** (14.5) -- api.ui.registerView() contract
6. **Disabled dependency handling** (13.5) -- Graceful degradation with actionable warnings
7. **Layout preset switching** (13.5) -- Ctrl+Shift+L command palette

### Appropriately Served Areas
- Multi-window performance (11.0) -- WAL mode + single backend already provides foundation
- Sidebar customization (10.0) -- Nice-to-have, low daily friction
- Data contention prevention (11.2) -- WAL mode handles this at database level
