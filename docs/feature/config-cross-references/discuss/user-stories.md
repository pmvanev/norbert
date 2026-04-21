<!-- markdownlint-disable MD024 -->

# config-cross-references User Stories

> Persona: **Ravi Patel** -- Claude Code power user who works across agents,
> commands, skills, hooks, MCP servers, rules, and plugins daily. Inherited
> from `docs/feature/norbert-config/discuss/user-stories.md`.

## System Constraints

These apply to every story unless explicitly overridden.

1. **Single-plugin scope**: this feature lives entirely inside the norbert-config plugin. No changes to Norbert core, to other plugins, or to Claude Code itself.
2. **Read-only**: navigation never modifies user files. Clicking a reference opens a view; it never writes to disk.
3. **No active Claude Code session required**: feature works offline, purely against the local `.claude/` filesystem view already loaded by norbert-config.
4. **Max split depth = 2**: at any point the detail pane is either a single pane OR a top+bottom split. Never three or more panes.
5. **Configuration-view-scoped keybindings**: Alt+Left / Alt+Right / Esc handlers must not intercept when another Norbert top-level view is active.
6. **Navigation history is in-memory only** (for v1). Not persisted across Norbert restarts.
7. **Scope precedence constant**: `project > plugin > user` for disambiguation defaults (matches Claude Code's own resolution order). Documented in the domain module; changing it requires a story.
8. **Accessibility baseline**: every interactive reference token reachable by Tab, activatable by Enter/Ctrl+Enter, with visible focus ring. 4.5:1 contrast for default/hover/dead/ambiguous token variants.
9. **Performance budget**: p95 click-to-render <= 250ms for references resolving within the in-memory registry.
10. **Dead references never crash**: every unresolvable click degrades gracefully.

## Impacted Journeys

- **Primary**: `docs/feature/config-cross-references/discuss/journey-cross-reference-navigation.yaml` (all steps).
- **Parent**: `docs/feature/norbert-config/discuss/journey-config-viewer.yaml` -- Step 6 ("Inspect Entity Detail") is extended: the detail pane now supports in-place cross-reference navigation.

---

## US-101: Reference tokens are detected and styled in detail markdown

### Problem
Ravi Patel is reading the detail panel for the `/release` command in the Configuration viewer. The body mentions `nw-bdd-requirements` as a skill he should load, and `.claude/hooks/pre-release.sh` as a related hook. He finds it annoying that these references are just plain text -- he has to mentally note the name, switch sub-tabs, scroll the list, and find the target himself. There is no visual cue that these names correspond to items he could navigate to.

### Who
- Claude Code power user viewing a config item's detail markdown | references other items implicitly by name or by relative path | expects the UI to recognise and surface them.

### Solution
The detail pane renderer runs a reference-detection pass on the markdown and styles every detected reference as a clickable token with a subtle dotted underline in default state, a solid underline and arrow glyph on hover, and a visible focus ring when keyboard-focused. Four token variants:
- **live**: resolves to exactly one item (default)
- **ambiguous**: resolves to multiple items (distinct visual treatment, e.g. small badge `[2]`)
- **dead**: resolves to zero items (strikethrough + muted)
- **unsupported**: resolves to an item type the feature doesn't handle yet (muted + distinct tooltip)

Detection pipeline (prioritised):
1. Explicit markdown links where the href matches `./*.md`, `../*.md`, `/abs/...`, `~/.claude/...`, or `.claude/...` -- highest confidence.
2. Inline code spans (`` `foo` ``) where the span content matches a known item name.
3. Bare prose tokens: OFF by default in v1. OQ-4 flags this as needing user input.

Code blocks (fenced ```) are excluded entirely -- literal code is never linkified.

### Domain Examples

#### 1: Happy Path -- Markdown link resolves to a skill
Ravi Patel opens `/release` in sub-tab Commands. The body contains `Load the [nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md) skill`. The renderer detects the markdown link, resolves it via the reference registry to the user-scope skill `nw-bdd-requirements`, and styles it with the default live-reference style. On hover, Ravi sees a solid underline, the pointer cursor, and a small arrow glyph.

#### 2: Edge Case -- Inline code span matches a known command
Ravi opens the agent `nw-product-owner`. The body contains the sentence ``After loading, invoke `nw-solution-architect` to continue``. The renderer detects the inline code span, matches `nw-solution-architect` against the agent registry, and styles it as a live reference. A line below says ``run `ls -la` to check`` -- `ls -la` does not match any known item, so it stays as plain inline code.

#### 3: Error -- Dead reference
Ravi opens an outdated command `/old-release` whose body references `nw-retired-skill` (a skill he deleted last week). The detection pipeline looks up the name, finds no match in user, project, or plugin scopes, and renders the token with strikethrough and muted colour. On hover, a tooltip reads `Not found in your config. Searched: user, project, plugin scopes.`

### UAT Scenarios (BDD)

#### Scenario: Detail markdown with an explicit skill link is styled as a live reference
Given Ravi is viewing command `/release` in the Configuration viewer
And the command body contains `[nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md)`
And a skill named `nw-bdd-requirements` exists in user scope
When the detail pane renders
Then the link appears with a dotted underline in default state
And hovering the link shows a solid underline and pointer cursor
And the link carries a data attribute identifying it as a live cross-reference

#### Scenario: Inline code matching a known item is styled as a live reference
Given Ravi is viewing agent `nw-product-owner`
And the body contains an inline code span with text `nw-solution-architect`
And an agent named `nw-solution-architect` exists in project scope
When the detail pane renders
Then the inline code span is styled as a live reference
And an inline code span with unmatched text like `ls -la` remains plain inline code

#### Scenario: Inline code inside a fenced code block is never linkified
Given Ravi is viewing a command whose body has a fenced code block
And that block contains the literal text `nw-bdd-requirements`
When the detail pane renders
Then occurrences inside the fenced block are NOT styled as references
And only occurrences in prose are clickable

#### Scenario: Unresolvable reference is marked dead and explained
Given Ravi is viewing command `/old-release`
And the body contains a link to `[nw-retired-skill](...)`
And no item named `nw-retired-skill` exists in any scope
When the detail pane renders
Then the token renders with strikethrough and muted colour
And hovering the token shows a tooltip explaining it was not found
And the tooltip lists the scopes that were searched

#### Scenario: Ambiguous reference is visually distinguished from live
Given Ravi is viewing a command whose body references `release`
And a command `release` exists in BOTH user scope and project scope
When the detail pane renders
Then the token renders with the ambiguous variant style (e.g. a small `[2]` badge)
And the style is visually distinct from the live and dead variants

### Acceptance Criteria
- [ ] Every markdown link whose href matches a supported reference pattern renders as a live, ambiguous, dead, or unsupported token depending on registry lookup result.
- [ ] Every inline code span whose content matches a known item name renders as one of the four token variants.
- [ ] Content inside fenced code blocks is never styled as a reference.
- [ ] Each of the four variants (live, ambiguous, dead, unsupported) has a visually distinct style meeting 4.5:1 contrast.
- [ ] Tokens are keyboard-focusable with a visible focus ring.
- [ ] Dead-variant tokens expose an accessible tooltip (visible on hover AND on keyboard focus).

### Outcome KPIs
- **Who**: Claude Code power users viewing any detail pane in the Configuration viewer
- **Does what**: Encounter at least one clickable reference token per session where the underlying item has any reference
- **By how much**: >= 90% of detail panels with references render at least one live token within 30 days of release
- **Measured by**: Instrumentation -- `detail_pane_render` event including `reference_token_count` and `reference_live_count`
- **Baseline**: 0 (feature does not exist)

Traces to global KPI #1 (click success prerequisite).

### Technical Notes
- Integrate with the existing markdown rendering path in `ConfigDetailPanel.tsx` (currently `react-markdown` + `remark-gfm`). DESIGN wave selects the specific mechanism (AST transform plugin vs post-render walk vs regex pass).
- Reference registry is a new derived index over existing `AgentDefinition`, `CommandDefinition`, `SkillDefinition`, `HookConfig`, `McpServerConfig`, `RuleEntry`, `PluginInfo` data.
- **Registry refresh**: the reference registry is rebuilt when the parent norbert-config plugin's existing filesystem watcher fires. This story consumes the current registry snapshot on each detail pane render; it does not introduce a new watcher.
- **Supported reference types** (v1): agents, commands, skills, hooks, MCP servers, rules, plugins. File-path references (`./foo.md`, `~/.claude/...`) are resolved against this set; paths that do not correspond to any of the 7 types render as the `unsupported` variant with a tooltip explaining the file path but no click action. DESIGN wave may narrow this if `unsupported` is deemed out-of-scope for v1.
- Detection is a pure function over parsed markdown AST + registry snapshot.
- Open question OQ-4: bare-prose detection strategy deferred to DESIGN wave.

### Dependencies
- Depends on existing norbert-config plugin (parent feature is implemented).
- No dependencies on other in-flight features.

### MoSCoW: Must Have (R1 / Walking Skeleton)

### Job Story Traceability
Extends parent JTBD JS-1 and JS-4 and introduces JS-5-style job: "When I'm reading one config entity and it references another, I want to follow the reference in-place and come back, so I can build a mental model of how my configs compose without losing my place."

---

## US-102: Single-click on a reference opens a vertical split preview

### Problem
Ravi Patel sees a live reference token in the `/release` command detail pointing to skill `nw-bdd-requirements`. He wants to check what that skill says without losing his place in `/release`. Today there's no way to peek; if he navigates away, he'd have to find his way back to exactly the section he was reading.

### Who
- Power user reading one config item | wants to peek at a referenced item without committing a full navigation.

### Solution
When Ravi single-clicks a live reference token, the detail pane splits vertically. The top half keeps the original item (unchanged scroll position, unchanged everything). The bottom half renders a preview of the referenced item: item type badge, scope badge, name, source path, and the first chunk of the content (truncated to a reasonable height; scrollable). The bottom pane carries `Open fully` and `Close` controls. The list pane (primary panel) is UNCHANGED: same sub-tab, same selection.

Pushing the reference click is a history event (see US-104).

### Domain Examples

#### 1: Happy Path -- Peek and keep reading
Ravi is reading `/release`. He single-clicks `nw-bdd-requirements`. The detail pane splits in half. Top: `/release` exactly where he was. Bottom: a preview of the skill `nw-bdd-requirements` with its type badge, user-scope badge, source path `~/.claude/skills/nw-bdd-requirements/SKILL.md`, and the opening paragraphs. Ravi reads the bottom, learns what he needed, then keeps reading the top half. The list pane still shows `/release` highlighted.

#### 2: Edge Case -- Single-click while split is already open
Ravi has the split open with `/release` on top and `nw-bdd-requirements` on bottom. He single-clicks another reference in the top pane, this time `pre-release.sh` (a hook). The bottom pane's content is REPLACED with the hook preview. The top stays on `/release`. The pane structure stays 1 + 1.

#### 3: Error -- Single-click on a dead reference
Ravi single-clicks `nw-retired-skill` (a dead reference). The click is a no-op: no split opens, no history entry pushed, no panel changes. The reference's existing tooltip already explained the situation.

### UAT Scenarios (BDD)

#### Scenario: Single-click opens a vertical split with the referenced item previewed
Given Ravi is viewing command `/release` in the Configuration viewer
And the detail pane is a single pane
When Ravi single-clicks the live reference to skill `nw-bdd-requirements`
Then the detail pane splits vertically into two halves
And the top half still shows command `/release` at the same scroll position
And the bottom half shows a preview of skill `nw-bdd-requirements`
And the bottom preview shows item type, scope, name, source path, and content
And the list pane selection is still `/release` in sub-tab `commands`

#### Scenario: Single-click inside an already-open split replaces the bottom
Given the detail pane is split with `/release` on top and skill X on bottom
When Ravi single-clicks a reference to skill Y inside the top pane
Then the bottom pane content is replaced with a preview of skill Y
And the pane structure stays 1 top + 1 bottom (no third pane is created)

#### Scenario: Single-click on a dead reference does nothing
Given the detail pane is a single pane showing `/release`
And the body contains a dead reference token for `nw-retired-skill`
When Ravi single-clicks the dead reference
Then the detail pane remains a single pane
And the list pane is unchanged
And no history entry is pushed

#### Scenario: Keyboard Enter on a focused reference behaves as single-click
Given Ravi has Tab-focused a live reference token in `/release`
When Ravi presses Enter
Then the detail pane splits vertically with the referenced item previewed

### Acceptance Criteria
- [ ] Single-click on a live reference opens a vertical split with the referenced item previewed in the bottom pane.
- [ ] Top pane retains the original item AND its scroll position AND its focus.
- [ ] Bottom pane shows type, scope, name, source path, and content preview.
- [ ] Single-click inside an already-open split replaces the bottom pane -- never creates a third pane.
- [ ] Click on a dead reference is a no-op (no split, no history push).
- [ ] Keyboard Enter on a focused reference behaves identically to single-click.
- [ ] List pane (primary) is not modified by single-click (same sub-tab, same selection).
- [ ] Click-to-render-complete p95 <= 250ms for references resolving within the in-memory registry (per global guardrail KPI #6).

### Outcome KPIs
- **Who**: power users who encounter a live reference in the Configuration viewer
- **Does what**: successfully open a split preview of the target
- **By how much**: >= 80% of single-click events on live references result in a rendered split preview within 30 days of release
- **Measured by**: `cross_ref_click` event with `interaction: single_click`, `result: success`
- **Baseline**: 0 (feature does not exist)

Traces to global KPI #1 and KPI #3.

### Technical Notes
- Split pane layout: CSS-grid or flex on `ConfigDetailPanel`. Resizable divider is desirable (see DESIGN wave).
- Bottom pane is a reuse of the existing detail renderer with `mode: preview` prop that enables truncation + extra header chrome.
- State owner: `ConfigDetailPanel` local state (`split_state: null | { topRef, bottomRef, dividerRatio }`).
- No changes to `ConfigListPanel` required.

### Dependencies
- Depends on US-101 (reference detection must exist first).

### MoSCoW: Must Have (R1 / Walking Skeleton)

### Job Story Traceability
JS-5 style: "peek without losing my place".

---

## US-103: Ctrl+click on a reference replaces detail AND syncs primary panel

### Problem
Ravi Patel is reading `/release` in the Commands sub-tab. He sees a reference to skill `nw-bdd-requirements` (in the Skills sub-tab). He wants to fully navigate to that skill -- switch to Skills sub-tab, select `nw-bdd-requirements` in the list, and see its full detail page, not just a preview. Today Ctrl+click has no meaning in the Configuration viewer.

### Who
- Power user who has already peeked (or knows the target) and wants to COMMIT to navigating there, with the full list-pane context switching too.

### Solution
When Ravi Ctrl+clicks a live reference token, three state updates happen atomically:
1. `active_sub_tab` switches to the sub-tab that hosts the target item's type (e.g. `skills` if target is a skill).
2. `selected_list_item` moves to the target item AND the list pane scrolls to bring it into view.
3. `split_state` resets to `null` and the detail pane renders the target item in full, single-pane.

A history entry is pushed (see US-104). Ctrl+click on a dead reference is a no-op. Ctrl+click on an ambiguous reference triggers the disambiguation popover (see US-108); after the user confirms a choice, the Ctrl+click semantics apply.

### Domain Examples

#### 1: Happy Path -- Cross-sub-tab navigation
Ravi is on sub-tab `commands`, viewing `/release`. He Ctrl+clicks `nw-bdd-requirements`. The sub-tab strip switches to `skills` (highlight moves, `commands` deselects, `skills` selects). The list pane reloads the skills list, scrolls to `nw-bdd-requirements`, and highlights that row. The detail pane replaces `/release` with the full `nw-bdd-requirements` skill page (no split). A history entry is pushed.

#### 2: Edge Case -- Within-sub-tab Ctrl+click
Ravi is on sub-tab `skills`, viewing skill `nw-bdd-requirements`. He Ctrl+clicks a reference to skill `nw-discovery-methodology`. The sub-tab stays `skills`. The list pane selection moves to `nw-discovery-methodology` and scrolls into view. The detail pane replaces the skill with the new one. A history entry is pushed.

#### 3: Error -- Ctrl+click on a dead reference
Ravi Ctrl+clicks `nw-retired-skill` (dead). Nothing changes. No sub-tab switch. No list selection change. No detail pane change. No history push.

### UAT Scenarios (BDD)

#### Scenario: Ctrl+click across sub-tabs switches sub-tab, list selection, and detail atomically
Given Ravi is in sub-tab `commands` viewing `/release`
And the body contains a live reference to skill `nw-bdd-requirements`
When Ravi Ctrl+clicks the reference
Then the active sub-tab becomes `skills`
And the list pane selection becomes `nw-bdd-requirements`
And the list pane scrolls so the selected row is visible
And the detail pane shows `nw-bdd-requirements` in full (no split)
And a history entry is pushed

#### Scenario: Ctrl+click within the same sub-tab swaps only the selection
Given Ravi is in sub-tab `skills` viewing `nw-bdd-requirements`
When Ravi Ctrl+clicks a reference to `nw-discovery-methodology`
Then the sub-tab stays `skills`
And the list pane selection becomes `nw-discovery-methodology`
And the detail pane shows `nw-discovery-methodology` in full
And a history entry is pushed

#### Scenario: Ctrl+click resets any open split
Given Ravi has a split open (top: `/release`, bottom: skill X)
When Ravi Ctrl+clicks a reference to skill Y
Then the split is closed
And the detail pane shows skill Y in full
And the list pane selection matches skill Y

#### Scenario: Ctrl+click on a dead reference is a full no-op
Given Ravi is viewing `/release`
And the body contains a dead reference
When Ravi Ctrl+clicks the dead reference
Then the sub-tab, list selection, detail, and history are all unchanged

#### Scenario: Ctrl+Enter on a focused reference behaves as Ctrl+click
Given Ravi has Tab-focused a live reference token
When Ravi presses Ctrl+Enter
Then the Ctrl+click semantics apply exactly as if he clicked with Ctrl held

### Acceptance Criteria
- [ ] Ctrl+click on a live reference updates sub-tab + list selection + detail atomically.
- [ ] List pane scrolls to bring the newly-selected item into view.
- [ ] Any open split is closed as part of the Ctrl+click update.
- [ ] Ctrl+click on a dead reference is a no-op.
- [ ] Ctrl+click on an ambiguous reference triggers the disambiguation popover (US-108), then applies Ctrl+click semantics on confirmation.
- [ ] Ctrl+Enter on a focused reference is equivalent.
- [ ] The browser/OS default for Ctrl+click on a link is suppressed inside the Configuration viewer.
- [ ] After Ctrl+click, Alt+Left returns exactly to the pre-click state (see US-104).
- [ ] Click-to-render-complete p95 <= 250ms for references resolving within the in-memory registry (per global guardrail KPI #6).

### Outcome KPIs
- **Who**: power users who Ctrl+click a live reference
- **Does what**: reach the target item in full detail with matching list-pane selection
- **By how much**: >= 90% of Ctrl+click events result in all three of (sub-tab, list selection, detail) matching the target within 30 days
- **Measured by**: `cross_ref_click` event with `interaction: ctrl_click`, `result: success`, AND post-click state validation event
- **Baseline**: 0

Traces to global KPI #1 and KPI #3.

### Technical Notes
- Requires lifting state coordination above `ConfigDetailPanel` and `ConfigListPanel`, OR introducing a Configuration-view-scoped state container that both panels subscribe to. DESIGN wave decides the shape.
- Suppress browser default: `event.preventDefault()` and `event.stopPropagation()` in the click handler for tokens with Ctrl held. (macOS: Cmd+click should have the same semantics -- add a cross-platform note.)
- Filter-bar preservation on sub-tab switch: see open question OQ-1 in the journey yaml.

### Dependencies
- Depends on US-101 (detection) and US-102 (for the split-reset behaviour to be observable).

### MoSCoW: Must Have (R1 / Walking Skeleton)

### Job Story Traceability
JS-5 style: "commit to navigating, with the whole UI following me".

---

## US-104: Alt+Left and Alt+Right traverse navigation history

### Problem
Ravi Patel has followed a chain: `/release` -> peek at `nw-bdd-requirements` -> peek at `pre-release.sh` -> Ctrl+click to `nw-bdd-requirements` fully -> Ctrl+click to `nw-discovery-methodology`. He realises he wants to go back to the second peek. Today the only way is to manually remember the path and click back through it -- which defeats the entire "don't lose my place" promise.

### Who
- Power user who has made one or more cross-reference navigation actions and wants to retrace or re-advance.

### Solution
A navigation history stack scoped to the Configuration view. Every cross-reference action (single-click opening a split, single-click replacing a bottom pane, Ctrl+click replacing and syncing, closing a split) pushes one entry. Each entry is a full state snapshot: `{ sub_tab, selected_list_item, split_state }`.

- Alt+Left restores the previous entry.
- Alt+Right restores the next entry (if the user has gone back and the forward stack isn't empty).
- Any new cross-reference action clears the forward stack.
- Alt+Left at the start of history is a no-op with a subtle "end of history" cue.
- Alt+Right at the end of history is a no-op.
- Alt+Left/Right ONLY act when the Configuration view is the active top-level Norbert view.
- Manual sub-tab switching or manual list-row selection does NOT push history (see open question OQ-2; this is the recommendation).
- Stack size: proposed LRU 50 (OQ-6).

### Domain Examples

#### 1: Happy Path -- Back and forward through a chain
Ravi has this history (HEAD at index 3):
- [0] commands, /release, split=closed
- [1] commands, /release, split={bottom: nw-bdd-req}
- [2] commands, /release, split={bottom: pre-release.sh}
- [3] skills, nw-bdd-requirements, split=closed (HEAD)

He presses Alt+Left. The UI restores [2]: sub-tab=commands, selected=/release, split reopens with pre-release.sh on bottom. HEAD moves to 2. Alt+Right is now enabled.

He presses Alt+Right. The UI restores [3]. HEAD moves to 3.

#### 2: Edge Case -- New navigation clears forward stack
From the same history above, suppose HEAD is at index 2 (he went back once). He single-clicks a new reference in the top pane. The old entry [3] is DISCARDED. A new entry at index 3 is pushed reflecting the new state. Alt+Right is now disabled again.

#### 3: Error -- Alt+Left when not in Configuration view
Ravi switches to the Sessions view (top-level Norbert tab). He presses Alt+Left. The Configuration history is NOT modified. The keystroke falls through to whatever Sessions does with Alt+Left (or the browser/OS default).

### UAT Scenarios (BDD)

#### Scenario: Alt+Left restores the previous navigation snapshot
Given the navigation history has entries 0..3 with HEAD at index 3
When Ravi presses Alt+Left
Then the UI state exactly matches the snapshot at index 2
And HEAD is at index 2
And Alt+Right becomes available

#### Scenario: Alt+Right advances after going back
Given HEAD is at index 2 of a 4-entry history
When Ravi presses Alt+Right
Then the UI state exactly matches the snapshot at index 3
And HEAD is at index 3

#### Scenario: A new navigation clears the forward stack
Given HEAD is at index 2 of a 4-entry history (entry 3 exists ahead)
When Ravi performs a new cross-reference action
Then the old entry 3 is discarded
And a new entry is pushed at index 3 reflecting the new state
And Alt+Right is no longer available

#### Scenario: Alt+Left at the start of history is a no-op with a cue
Given HEAD is at index 0
When Ravi presses Alt+Left
Then the UI state does not change
And a subtle end-of-history cue is shown (pane shake or status message)
And no error is logged

#### Scenario: Alt+Left only acts within the Configuration view
Given the active Norbert top-level view is `sessions` (not `configuration`)
When Ravi presses Alt+Left
Then the Configuration history is not modified
And the keystroke falls through to the default handler

#### Scenario: Alt+Left after a sequence of mixed navigations restores exactly
Given Ravi has performed: single-click (split open), single-click (bottom replaced), Ctrl+click (replace + sync), single-click (new split from new position)
When Ravi presses Alt+Left three times
Then the three snapshots preceding HEAD are restored in reverse order, each matching exactly

### Acceptance Criteria
- [ ] Every cross-reference action (single-click open, single-click replace, Ctrl+click, close split) pushes exactly one history entry.
- [ ] Alt+Left decrements HEAD and restores the snapshot bit-for-bit.
- [ ] Alt+Right increments HEAD and restores the snapshot bit-for-bit.
- [ ] A new navigation action after going back clears the forward stack.
- [ ] At start-of-history, Alt+Left is a no-op with a visible cue.
- [ ] At end-of-history, Alt+Right is a no-op (no cue needed, or very subtle).
- [ ] Handlers are scoped to the Configuration view -- no interception when another top-level view is active.
- [ ] Manual sub-tab or list-row selection does NOT push history.
- [ ] Stack size is capped at 50 entries (LRU oldest eviction).

### Outcome KPIs
- **Who**: power users who use Alt+Left or Alt+Right
- **Does what**: successfully restore a previously-visited navigation state
- **By how much**: >= 98% of Alt+Left/Right events result in a state matching the snapshot
- **Measured by**: `nav_history_restore` event with `{direction, matched_snapshot: boolean}`
- **Baseline**: 0

Traces to global KPI #4 (reliability guardrail).

### Technical Notes
- New state container for Configuration-view-scoped history.
- Key handlers bind on the Configuration view root, not globally.
- Snapshot structure: `{ subTab: SubTabId, listItemId: ItemId, splitState: SplitState | null, at: number }`.
- Restoring a snapshot requires writing to `ConfigListPanel` state (sub-tab + selection) and `ConfigDetailPanel` state (split); both writes must happen in the same tick to avoid flicker.

### Dependencies
- Depends on US-101, US-102, US-103 (history entries are generated by those actions).

### MoSCoW: Must Have (R1 / Walking Skeleton)

### Job Story Traceability
JS-5 emotional core: "I can always come back."

---

## US-107: Dead references are non-interactive and self-explanatory

### Problem
Ravi Patel has an outdated `/release` command whose body references `nw-retired-skill` -- a skill he deleted. Today, if cross-reference navigation existed naively, clicking `nw-retired-skill` would either crash, navigate to an empty pane, or do nothing without explanation -- any of which destroys trust in the feature.

### Who
- Any user encountering a reference whose target no longer exists (deleted, renamed, scope mismatch, typo in source file).

### Solution
Dead references are detected at render time (see US-101, variant `dead`). They render with strikethrough + muted colour. They expose an accessible tooltip that is visible on hover AND on keyboard focus, explaining:
- The reference was not found
- The scopes that were searched (user, project, plugin)
- Optionally, a did-you-mean suggestion if a close match exists (deferred to R3)

Clicks on dead references are no-ops: no split, no sub-tab switch, no list change, no history push, no exception. The tooltip is the only feedback.

### Domain Examples

#### 1: Happy Path -- Tooltip explains the dead reference on hover
Ravi hovers `nw-retired-skill`. The tooltip appears within 500ms reading "Not found in your config. Searched: user, project, plugin scopes." He nods, continues reading the rest of the markdown.

#### 2: Edge Case -- Keyboard focus shows the same tooltip
Ravi Tabs to the dead reference token (it is still keyboard-focusable for discoverability). A focus ring appears AND the tooltip appears. He presses Enter; nothing happens except the tooltip re-announcing via screen reader.

#### 3: Error -- Single-click and Ctrl+click are both no-ops
Ravi single-clicks the dead reference. No split opens. He Ctrl+clicks. No sub-tab switch, no list change, no detail change. He presses Alt+Left; history is unchanged because no entries were pushed.

### UAT Scenarios (BDD)

#### Scenario: Dead reference is visually distinct and meets contrast requirements
Given the detail body contains a reference to `nw-retired-skill`
And no item with that name exists in any scope
When the detail pane renders
Then the token has strikethrough and muted colour meeting 4.5:1 contrast
And the token is distinguishable from live, ambiguous, and unsupported variants

#### Scenario: Tooltip appears on hover after a short delay
Given a dead reference is rendered
When Ravi hovers the token for more than 500ms
Then the tooltip appears
And the tooltip text names the scopes that were searched (user, project, plugin)

#### Scenario: Tooltip also appears on keyboard focus
Given a dead reference is rendered
And the reference is keyboard-focusable
When Ravi Tab-focuses the dead reference
Then the same tooltip appears without requiring mouse hover
And screen readers announce the tooltip contents

#### Scenario: Click on dead reference is a full no-op
Given a dead reference is rendered
When Ravi single-clicks or Ctrl+clicks it
Then no split opens
And the sub-tab and list selection do not change
And no history entry is pushed
And no error is logged

### Acceptance Criteria
- [ ] Dead references render with a visually-distinct style (strikethrough + muted colour), 4.5:1 contrast.
- [ ] Dead references are keyboard-focusable.
- [ ] Tooltip appears on hover (within 500ms) AND on keyboard focus.
- [ ] Tooltip names all scopes searched.
- [ ] Single-click and Ctrl+click on dead references are no-ops.
- [ ] No history entries are pushed from dead-reference interactions.

### Outcome KPIs
- **Who**: users encountering a dead reference
- **Does what**: understand the reference is dead without triggering an error, a crash, or an empty-pane state
- **By how much**: 0% of dead-reference clicks result in a crash, empty pane, or silent nothing; 100% result in tooltip-explained no-op
- **Measured by**: `cross_ref_click` event with `result: dead` count, plus exception telemetry
- **Baseline**: N/A (new)

Traces to global KPI #1 (safety) and KPI #5 (trust).

### Technical Notes
- Detection produces the `dead` variant at render time (US-101 handles the detection).
- Tooltip component must be accessible (ARIA-compliant); use existing Norbert tooltip primitive if available, otherwise introduce one in the norbert-config plugin scope.

### Dependencies
- Depends on US-101 (detection must produce the dead variant).

### MoSCoW: Must Have (R1 / Walking Skeleton)

### Job Story Traceability
JS-5 safety: "the feature never breaks on a stale ref."

---

## US-105: Closing the split returns to single-pane view

### Problem
Ravi Patel has the detail pane split with `/release` on top and a skill preview on bottom. He's finished with the preview. Without an easy way to collapse back, the split takes up half his reading space unnecessarily -- which erodes the value of the peek.

### Who
- Any user who has opened a split and wants to reclaim the full detail pane for the top item.

### Solution
The split bottom pane has a `Close` button in its header. Pressing it, OR pressing Esc while focus is in the split area, collapses the split back to single-pane view showing the top item. A history entry is pushed so that Alt+Left can reopen the split. Optionally, Alt+Left when HEAD is a split-closed entry and the previous entry is the same top-item-with-split reopens it (this is exactly how the history stack already works, no special logic required).

### Domain Examples

#### 1: Happy Path -- Close button collapses the split
Ravi clicks Close. The split collapses. The top pane (now the only pane) shows `/release` at the same scroll position it had before the close. A history entry is pushed.

#### 2: Edge Case -- Esc inside the split closes it
Ravi's keyboard focus is somewhere in the bottom pane. He presses Esc. Same result: split collapses.

#### 3: Error -- Esc with no split open is handled without crash
Ravi has no split open. He presses Esc. Nothing happens (the key is delegated to other handlers if any, otherwise ignored). No crash, no history pollution.

### UAT Scenarios (BDD)

#### Scenario: Close button collapses the split
Given the detail pane is split
When Ravi clicks the Close button in the bottom pane header
Then the split collapses
And the detail pane shows the top item in single-pane
And a history entry is pushed reflecting split=closed

#### Scenario: Esc inside the split closes it
Given the detail pane is split and keyboard focus is within the bottom pane
When Ravi presses Esc
Then the split collapses identically to the Close button

#### Scenario: Esc outside a split is not intercepted by this feature
Given the detail pane is a single pane (no split)
When Ravi presses Esc
Then this feature does not act on it
And any other Esc handler (if present) runs as normal

### Acceptance Criteria
- [ ] Close button in the bottom pane header collapses the split.
- [ ] Esc inside the split area collapses the split.
- [ ] Collapsing pushes one history entry.
- [ ] Top pane scroll position is preserved across the collapse.
- [ ] Esc with no split open is not intercepted by this feature.

### Outcome KPIs
- **Who**: users with an open split
- **Does what**: close the split intentionally
- **By how much**: >= 60% of opened splits are eventually closed via Close/Esc within the same session (balance indicator between "peek" and "abandoned split")
- **Measured by**: `split_close` event correlated against `split_open` events
- **Baseline**: N/A

Traces to global KPI #2 (flow completeness).

### Technical Notes
- Esc handler scoped to the split area only.
- Close button follows the existing norbert-config button visual style.

### Dependencies
- Depends on US-102 (split exists).

### MoSCoW: Should Have (R2)

### Job Story Traceability
JS-5 completeness: "the peek is a full round-trip, not a stuck state."

---

## US-106: Single-click inside the split replaces the bottom pane, never creates a third

### Problem
Ravi Patel has the split open -- `/release` on top, `nw-bdd-requirements` preview on bottom. While reading the preview (bottom), he sees another reference inside the top pane's markdown. He single-clicks it. The user expectation is the bottom pane updates, NOT that a third pane appears. Without this rule, the UI could proliferate panes uncontrollably.

### Who
- Any user with an open split who clicks another reference.

### Solution
All single-clicks while a split is open REPLACE the bottom pane's content. This applies regardless of whether the click is in the top pane or the bottom pane. The pane structure stays exactly 1 top + 1 bottom. Each replace pushes one history entry.

**Extension: where did the top item come from?** If a single-click is in the TOP pane, top stays and bottom is replaced. If a single-click is in the BOTTOM pane (i.e. one of the references in the preview), the bottom pane is replaced with the new target -- the top is still the original source. The top pane anchors the user's reading context and only changes on Ctrl+click (US-103) or Alt+Left/Right (US-104).

### Domain Examples

#### 1: Happy Path -- Click in top pane replaces bottom
Ravi has split open: top=/release, bottom=nw-bdd-requirements. He clicks `pre-release.sh` in the top pane's markdown. Bottom pane now previews `pre-release.sh`. Top pane unchanged. One history entry pushed.

#### 2: Edge Case -- Click in bottom pane replaces bottom (chains in the preview)
Ravi's bottom pane is previewing skill `nw-bdd-requirements`. The skill's own body references `nw-outcome-kpi-framework`. Ravi clicks it (still in the bottom pane). The bottom pane is replaced with `nw-outcome-kpi-framework`'s preview. The TOP pane is still `/release` (anchor unchanged). One history entry pushed.

#### 3: Error -- Click on dead reference in bottom pane
Ravi clicks a dead reference inside the bottom pane. The bottom is NOT replaced. No history push. Tooltip appears as per US-107.

### UAT Scenarios (BDD)

#### Scenario: Click in top pane while split is open replaces only the bottom pane
Given the detail pane is split (top: /release, bottom: skill X)
When Ravi single-clicks a live reference in the top pane
Then the bottom pane is replaced with the new target's preview
And the top pane and its scroll position are unchanged
And the pane structure stays 1 top + 1 bottom

#### Scenario: Click in bottom pane replaces the bottom pane, preserving the top anchor
Given the detail pane is split (top: /release, bottom: skill X)
And skill X's preview contains a reference to skill Y
When Ravi single-clicks the reference to skill Y in the bottom pane
Then the bottom pane is replaced with skill Y's preview
And the top pane is still /release
And the pane structure stays 1 top + 1 bottom

#### Scenario: Dead reference click in split does not replace anything
Given the detail pane is split
And a dead reference exists in either pane
When Ravi single-clicks the dead reference
Then neither pane is replaced
And no history entry is pushed

### Acceptance Criteria
- [ ] With a split open, any live-reference single-click replaces the bottom pane only.
- [ ] The top pane is the anchor; it changes only on Ctrl+click or history traversal.
- [ ] The top pane never changes as a result of a click inside the bottom pane.
- [ ] The pane structure stays 1 top + 1 bottom at all times.
- [ ] Each replace pushes one history entry.
- [ ] Dead-reference clicks in either pane are no-ops.

### Outcome KPIs
- **Who**: users with an open split who click another reference
- **Does what**: chain through multiple previews without creating nested panes
- **By how much**: median chain length inside a single split session >= 2 within 60 days
- **Measured by**: `cross_ref_click` events grouped by split session
- **Baseline**: N/A

Traces to global KPI #3.

### Technical Notes
- Single-invariant enforcement: "split_state.bottom is the only slot that single-click can write."
- No third-pane rendering path exists -- enforced at type level if possible (the `split_state` type has exactly two slots).

### Dependencies
- Depends on US-102 (split exists).

### MoSCoW: Should Have (R2)

### Job Story Traceability
JS-5 chain navigation: "follow a chain without disorientation."

---

## US-108: Ambiguous reference surfaces a disambiguation popover

### Problem
Claude Code configs commonly use the same name across scopes -- Ravi has a project-scope `release` command AND a user-scope `release` command. When the markdown says `release`, the feature must pick one. Silently picking one (even by a documented precedence) would betray Ravi's trust: he'd click `release` expecting one thing and get another, with no cue that there WAS a choice to make.

### Who
- Any user interacting with a reference that matches multiple items.

### Solution
When a reference resolves to 2+ items, it renders as the `ambiguous` variant (visually distinct from live, e.g. with a small count badge `[2]`). On single-click, Ctrl+click, or Enter, a disambiguation popover appears near the token, listing all candidates with their scope badges and short descriptions. The candidate at the top is pre-highlighted using scope precedence (`project > plugin > user`). Arrow keys change the highlighted candidate; Enter confirms. Esc cancels.

After confirmation:
- If the interaction was single-click / Enter, single-click semantics apply (US-102).
- If the interaction was Ctrl+click / Ctrl+Enter, Ctrl+click semantics apply (US-103).
- Cancellation is a no-op: no split, no sub-tab switch, no list change, no history push.

### Domain Examples

#### 1: Happy Path -- User picks a scope
Ravi single-clicks `release` (ambiguous: project and user scopes). Popover appears listing:
- `[project] Cuts a release` (pre-highlighted)
- `[user] Generic release script`

He hits Down-arrow, highlighting the user-scope entry, then Enter. The split opens with the USER-scope `release` previewed.

#### 2: Edge Case -- Default precedence via immediate Enter
Ravi single-clicks `release`, popover appears with project-scope pre-highlighted. He immediately presses Enter. The project-scope `release` opens in split preview. The popover dismisses.

#### 3: Error -- Cancellation
Ravi single-clicks `release`, popover appears. He presses Esc. Popover dismisses. Nothing else changes. No history push.

### UAT Scenarios (BDD)

#### Scenario: Ambiguous reference shows a disambiguation popover on single-click
Given a reference resolves to a project-scope command and a user-scope command
When Ravi single-clicks the ambiguous token
Then a popover appears near the token
And the popover lists both candidates with scope badges and descriptions
And the project-scope candidate is pre-highlighted
And arrow keys change the highlight
And the popover is accessible to screen readers

#### Scenario: Confirming with Enter applies the triggering interaction's semantics
Given the disambiguation popover is open
And the trigger was single-click
When Ravi highlights the user-scope candidate and presses Enter
Then the split opens previewing the user-scope command
And a history entry is pushed

#### Scenario: Ctrl+click through disambiguation applies Ctrl+click semantics
Given the popover is open because Ravi Ctrl+clicked the ambiguous reference
When Ravi confirms a candidate
Then the sub-tab, list selection, and detail all sync to the chosen candidate
And a history entry is pushed

#### Scenario: Esc cancels the popover with no side effects
Given the popover is open
When Ravi presses Esc
Then the popover closes
And no navigation, no state change, and no history entry occur

#### Scenario: Default precedence applies when user presses Enter without changing selection
Given the popover is open with project-scope pre-highlighted by default
When Ravi presses Enter without moving the highlight
Then the project-scope candidate is chosen
And the triggering interaction's semantics apply

### Acceptance Criteria
- [ ] Ambiguous references render with a distinct visual variant.
- [ ] Click (single or Ctrl) on an ambiguous reference opens the popover.
- [ ] Popover pre-highlights the candidate ranked highest by `project > plugin > user`.
- [ ] Arrow keys navigate, Enter confirms, Esc cancels.
- [ ] Confirmation applies the triggering interaction's semantics (single-click or Ctrl+click).
- [ ] Cancellation is a no-op.
- [ ] Popover is keyboard-navigable AND screen-reader announced.
- [ ] No silent precedence fallback -- the popover ALWAYS appears for ambiguous refs.

### Outcome KPIs
- **Who**: users interacting with ambiguous references
- **Does what**: explicitly confirm a scope choice
- **By how much**: 100% of ambiguous reference interactions route through the popover (no silent fallback)
- **Measured by**: `ambiguous_ref_resolve` event with `method: popover`
- **Baseline**: N/A

Traces to global KPI #5 (trust guardrail).

### Technical Notes
- Popover primitive: use existing Norbert popover/tooltip primitive if available.
- Positioning: prefer bottom-left of the token, flip to top if clipped by viewport.
- Keyboard trap while open: Tab is trapped inside the popover; Shift+Tab to reverse.

### Dependencies
- Depends on US-101 (detection emits the `ambiguous` variant).
- Depends on US-102 and US-103 (interaction semantics applied after confirmation).

### MoSCoW: Should Have (R2)

### Job Story Traceability
JS-5 trust: "the feature never resolves ambiguity silently."

---

## US-109: Deleted-mid-click and permission-denied degrade gracefully

### Problem
Between the moment a reference is detected at render time and the moment Ravi clicks it, the underlying file could be deleted (another process, a git operation, a manual `rm`), or its permissions could change. Today a naive implementation would crash, show an empty pane, or silently do nothing. Each is a trust-killer.

### Who
- Any user whose filesystem changes between render and click (common during active development).

### Solution
Two soft-failure modes:

1. **Deleted-mid-click**: click handler looks up the target in the registry. If missing, surface an inline toast at the pane header: "This item was removed. Showing last known data." The bottom pane (if split) shows the cached content with an error banner. The reference is marked dead on next render. No crash.

2. **Permission denied**: the split opens but the bottom pane contains a "Permission denied" panel that still shows name, type, scope, and path so the user can diagnose. Optional "Retry" button re-reads the file.

Both cases push a history entry so Alt+Left still works.

### Domain Examples

#### 1: Happy Path -- File deleted between render and click
Ravi opens `/release` at 10:00. At 10:01 another process deletes `pre-release.sh`. At 10:02 Ravi clicks the reference to `pre-release.sh`. The click handler sees the target is now missing. A toast appears at the pane header: "This item was removed since the panel was loaded." The detail pane does not split. On the next render of `/release`, `pre-release.sh` is rendered as a dead reference.

#### 2: Edge Case -- Permission denied on target
Ravi clicks a reference to a command file whose permissions were changed to 000. The split opens. The bottom pane shows a panel reading "Permission denied" with the file path, item type, scope, and a Retry button. The top pane is unchanged.

#### 3: Error -- Retry after user fixes permissions
Ravi fixes the permissions in his terminal (`chmod 644 ...`). He clicks Retry in the bottom pane. The file is re-read. If successful, the bottom pane replaces the error panel with the normal preview. If still failing, the error panel stays with an updated timestamp.

### UAT Scenarios (BDD)

#### Scenario: Deleted-mid-click surfaces a toast and avoids crash
Given Ravi has the /release detail open
And at click time the referenced file has been deleted
When Ravi clicks the reference
Then a toast appears at the pane header explaining the removal
And the detail pane does not enter a broken state
And no unhandled exception is logged
And the reference is rendered as dead on the next re-render

#### Scenario: Permission denied opens a preview with error panel
Given a reference target exists but cannot be read due to permissions
When Ravi single-clicks it
Then the split opens
And the bottom pane shows a Permission Denied panel
And the panel includes the target's name, type, scope, and file path
And a Retry button is visible

#### Scenario: Retry recovers on permission fix
Given the bottom pane shows a Permission Denied panel
And the user has since fixed the file's permissions
When Ravi clicks Retry
Then the bottom pane re-reads the file
And the preview renders normally

#### Scenario: History navigation still works after a soft-failure
Given Ravi has encountered either a deleted-mid-click OR a permission-denied state
When Ravi presses Alt+Left
Then the pre-soft-failure state is restored exactly

### Acceptance Criteria
- [ ] Deleted-mid-click surfaces a toast at the pane header (not modal, not blocking).
- [ ] Deleted-mid-click does not crash, does not leave an empty broken pane.
- [ ] Permission denied opens the split with a dedicated error panel that still shows identifying metadata.
- [ ] Retry button re-reads the file and updates the panel.
- [ ] Both soft-failure modes push a history entry so Alt+Left works.
- [ ] No unhandled exceptions reach the console or error boundary.

### Outcome KPIs
- **Who**: users whose filesystem changes between render and click
- **Does what**: experience a graceful soft-failure rather than a crash or empty pane
- **By how much**: 0 unhandled exceptions from cross-reference clicks per 1000 events, measured weekly
- **Measured by**: exception telemetry filtered by `cross_ref_click` origin
- **Baseline**: N/A

Traces to global KPI #1 (success rate via denominator) and implicit reliability.

### Technical Notes
- The registry is already rebuilt on filesystem change events (from parent norbert-config). On click, re-check the target's liveness before opening.
- Toast component: reuse existing Norbert toast primitive if available.
- Error panel component: new, small. Follows the existing `config-detail-content` styling.

### Dependencies
- Depends on US-102 (split exists, preview path available).

### MoSCoW: Should Have (R2)

### Job Story Traceability
JS-5 resilience: "the feature never breaks when the filesystem shifts under me."

---

## US-110: Keyboard-only users can perform the full cross-reference journey

### Problem
Ravi Patel frequently uses the keyboard for repetitive actions -- he's a power user who invested in learning shortcuts and dislikes reaching for the mouse. Today there's no keyboard path through the reference-navigation flow: even if each interaction individually supports keyboard, a gap anywhere (say, the disambiguation popover trapping focus wrongly, or the list pane not accepting focus after Ctrl+Enter) makes the whole flow unusable keyboard-only.

### Who
- Power users who prefer keyboard over mouse.
- Accessibility users who navigate entirely by keyboard or screen reader.

### Solution
Every interaction in this feature has a keyboard equivalent, and these equivalents compose end-to-end:

| Action | Keyboard | Mouse equivalent |
|--------|----------|------------------|
| Focus a reference | Tab / Shift+Tab (order: top pane refs -> bottom pane refs -> bottom pane controls) | hover + click |
| Peek (open split) | Enter (on focused ref) | single-click |
| Commit (replace + sync) | Ctrl+Enter (on focused ref) | Ctrl+click |
| Close split | Esc (focus in split area) or Enter on Close button | click Close |
| Traverse history | Alt+Left / Alt+Right | n/a |
| Disambiguate | Enter opens popover; Arrow keys navigate; Enter confirms; Esc cancels | click + click |

Focus management:
- After Ctrl+Enter that switches sub-tabs, focus moves to the list-pane row of the target, then the detail pane content gets `tabindex=-1` programmatic focus so screen readers announce the new context.
- After Alt+Left/Right, focus moves to the restored context's focal element.
- After disambiguation-popover confirm, focus returns to the triggering token.

### Domain Examples

#### 1: Happy Path -- Keyboard-only peek and commit
Ravi has `/release` detail open. He presses Tab until `nw-bdd-requirements` is focused (focus ring visible). He presses Enter. Split opens, preview on bottom, focus moves to the bottom pane's preview header for screen-reader announcement. He presses Shift+Tab back to the reference, then Ctrl+Enter. Sub-tab switches to skills, list selection moves, detail replaces, focus moves to the list row for `nw-bdd-requirements`.

#### 2: Edge Case -- Screen reader announces each transition
Ravi's screen reader is active. On every pane change (split open, split close, Ctrl+click replace, history restore), an ARIA live region announces the new context (e.g. "Preview open: skill nw-bdd-requirements, user scope").

#### 3: Error -- Focus does not get lost in dead state
Ravi Tab-focuses a dead reference. Enter does nothing (US-107). Focus stays on the dead reference. The tooltip is announced once by the screen reader. Tab continues to the next focusable element normally.

### UAT Scenarios (BDD)

#### Scenario: Full keyboard path from reading to navigating and back
Given Ravi is viewing the /release detail
When Ravi presses Tab to focus a live reference
And presses Enter to open the split
And presses Shift+Tab to return focus to the reference
And presses Ctrl+Enter to commit
And presses Alt+Left to go back
Then each action produces the expected outcome
And focus lands on the expected element at each step

#### Scenario: Focus returns to triggering token after disambiguation
Given an ambiguous reference is Tab-focused
When Ravi presses Enter
And chooses a candidate in the popover and presses Enter
Then the single-click semantics apply
And focus returns to the original reference token

#### Scenario: ARIA live announcements on pane changes
Given a screen reader is active
When a split opens, a split closes, or Ctrl+click replaces the detail
Then an ARIA live region announces the new context in a user-recognisable way

#### Scenario: Focus is not lost after Alt+Left / Alt+Right
Given Ravi has a sequence of history entries and focus is on a reference token
When Ravi presses Alt+Left
Then the restored state is rendered
And focus lands on a sensible focal element (the reference that led to this state, or the detail pane root)

### Acceptance Criteria
- [ ] Tab order traverses references in a predictable order (top pane first, then bottom pane, then bottom pane controls).
- [ ] Enter on a live reference is equivalent to single-click.
- [ ] Ctrl+Enter on a live reference is equivalent to Ctrl+click.
- [ ] Esc in the split area closes the split.
- [ ] Alt+Left / Alt+Right work regardless of current focus (within Configuration view).
- [ ] Disambiguation popover keyboard-navigable (Arrow keys, Enter, Esc, focus trap while open).
- [ ] After every navigation, focus lands on exactly ONE of: (a) the list-pane row of the new selection after a Ctrl+click, (b) the reference token that triggered a single-click or history-restore action if it still exists in the current DOM, or (c) the detail pane root element (with `tabindex=-1`) when neither (a) nor (b) applies. Behaviour is testable via automated focus assertion.
- [ ] ARIA live region announces pane changes.
- [ ] All interactive elements have visible focus ring meeting 4.5:1 contrast.

### Outcome KPIs
- **Who**: keyboard-preferring power users AND assistive-tech users
- **Does what**: complete full reference-navigation chains without touching the mouse
- **By how much**: >= 95% of observed keyboard-initiated cross-reference actions reach their expected end state
- **Measured by**: `cross_ref_click` events with `interaction: keyboard_enter | keyboard_ctrl_enter`, ratio of `result: success`
- **Baseline**: N/A

Traces to global KPI #2 (power-user retention).

### Technical Notes
- ARIA live region: existing Norbert pattern preferred; if none, add one scoped to the Configuration view.
- Focus management: React-friendly pattern -- imperative focus via refs, coordinated through the state container that owns history.
- WCAG 2.2 AA is the baseline target.

### Dependencies
- Depends on US-101, US-102, US-103, US-104, US-108.

### MoSCoW: Should Have (R2)

### Job Story Traceability
JS-5 Ravi-persona-specific: "keyboard-first power-user workflow."

---
