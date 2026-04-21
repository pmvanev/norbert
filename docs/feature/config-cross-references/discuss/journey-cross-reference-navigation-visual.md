# Journey: Cross-Reference Navigation in Configuration Viewer

Persona: Ravi Patel (Claude Code power user, already established in `norbert-config`).

Goal: Ravi is reading one config entity and wants to follow its references to other entities and back, without losing his place.

Parent: `docs/feature/norbert-config/discuss/journey-config-viewer.yaml` (tabs, list pane, detail pane already built).

---

## Emotional Arc

```
Start              Middle                  End
Curious            Engaged, building       Oriented
"What does         mental map              "I understand how
this touch?"       "Follow, peek, return"  my configs compose"
```

Transition rules applied:

- Confidence builds progressively -- first click is a peek (non-destructive split), not a jump.
- Ctrl+click is a commitment (primary + secondary both move) -- reserved for deliberate navigation.
- Alt+Left always rescues. History never dead-ends.
- Dead references never throw the user into an error view; they surface inline so the reader stays anchored in their current context.

---

## Journey Map (Horizontal)

```
[Activity 1]           [Activity 2]          [Activity 3]         [Activity 4]        [Activity 5]
 Spot reference    ->   Peek (single-click) -> Commit (Ctrl+click) -> Traverse history -> Close split
 in detail markdown     Split panel opens     Primary+secondary      Alt+Left / Right    Return to single
                        bottom = target       both re-align                              pane view

  Feels:                 Feels:                Feels:                Feels:              Feels:
  Curious                Engaged               Confident             Reassured           Satisfied
                         (nothing lost)        (deliberate jump)     (can always go back) (task complete)
```

---

## ASCII Mockups Per Step

### Step 1 -- Baseline: Single detail pane, reference detected

```
+-- Configuration ----------------------------------------------------------+
|  [Agents] [Commands] [Hooks] [MCP] [Skills] [Rules] [Plugins] [Env]      |
+---------------------------------------------------------------------------+
|                                 |                                         |
|  List pane (primary)            |  Detail pane (secondary)                |
|  Sub-tab: Commands              |                                         |
|                                 |  # /release                             |
|  [ release              ]       |  Scope: project                         |
|  [ ship                 ]       |  Source: .claude/commands/release.md    |
|  [ test-report          ]       |                                         |
|  [ jtbd-review          ]       |  Cuts a release.                        |
|                                 |                                         |
|                                 |  1. Load the ~nw-bdd-requirements~ skill|
|                                 |  2. Invoke the ~nw-product-owner~ agent |
|                                 |  3. See ~./release-notes.md~ template   |
|                                 |                                         |
|                                 |  Related:                               |
|                                 |  - ~.claude/hooks/pre-release.sh~       |
|                                 |                                         |
+---------------------------------------------------------------------------+

Reference tokens (~foo~) rendered with:
  - default: mono font + very subtle dotted underline
  - hover:   solid underline, cursor=pointer, small arrow glyph appears
  - focus:   focus ring (accessibility)
  - dead:    strikethrough + muted + tooltip "Not found in your config"
```

Entry emotion: Curious. Exit emotion: Oriented.

### Step 2 -- Single-click: Vertical split opens

```
+-- Configuration ----------------------------------------------------------+
|  [Agents] [Commands] [Hooks] [MCP] [Skills] [Rules] [Plugins] [Env]      |
+---------------------------------------------------------------------------+
|                                 |                                         |
|  List pane (UNCHANGED)          |  Detail TOP (original command/release)  |
|  Sub-tab: Commands              |  # /release                             |
|  > [ release         ] <- still |  Scope: project                         |
|  [ ship              ]  selected|  Source: .claude/commands/release.md    |
|  [ test-report       ]          |  1. Load the ~nw-bdd-requirements~ <<   |
|  [ jtbd-review       ]          |     ^^ clicked token, now underlined    |
|                                 +-----------------------------------------+
|                                 |  Detail BOTTOM (preview of target)      |
|                                 |  > Preview: Skill (from user scope)     |
|                                 |  # nw-bdd-requirements                  |
|                                 |  Scope: user                            |
|                                 |  Source: ~/.claude/skills/.../SKILL.md  |
|                                 |                                         |
|                                 |  BDD requirements discovery through     |
|                                 |  conversation, not tools or formats...  |
|                                 |                                         |
|                                 |  [ Open fully (Ctrl+click) ]  [ x Close]|
+---------------------------------------------------------------------------+

Split affordances:
  - Divider is draggable (resize top/bottom).
  - Bottom panel has header strip with:
      - origin badge ("Preview: Skill" or "Preview: Command")
      - scope badge
      - "Open fully" button (equivalent to Ctrl+click)
      - "Close" button (equivalent to Alt+Left or Esc)
  - References INSIDE the bottom pane are also clickable (same semantics).
    Single-click on a ref in the bottom pane REPLACES the bottom pane's content;
    it does NOT create a third split. Max split depth = 2.
```

Entry emotion: Curious (non-committal peek). Exit emotion: Engaged (nothing lost, still anchored in the original).

### Step 3 -- Ctrl+click: Replace + sync primary

```
User was in Commands sub-tab viewing /release.
User Ctrl+clicks "nw-bdd-requirements" (a Skill, in a different sub-tab).

Before:                                    After:
+-- Configuration -------+                 +-- Configuration -------+
|  [Cmds*]  [Skills]  ...|                 |  [Cmds]  [Skills*] ... |<-- sub-tab switched
+------------------------+                 +------------------------+
| Commands list          |                 | Skills list            |<-- list repopulated
| > release  <-selected  |                 | > nw-bdd-requirements  |<-- target selected
|   ship                 |                 |   nw-discovery-...     |   and scrolled to
|   ...                  |                 |   ...                  |
+------------------------+                 +------------------------+
| Detail: /release       |                 | Detail: skill full page|<-- single pane again
| split open at bottom   |                 | no split               |
+------------------------+                 +------------------------+

State change summary:
  active_sub_tab      : commands      -> skills
  selected_list_item  : /release      -> nw-bdd-requirements
  detail_primary      : /release      -> nw-bdd-requirements
  detail_split        : open          -> closed (reset)
  history_stack       : +1 entry pushed (see step 4)
  filter_bar          : preserved across sub-tab switch? -- see open question OQ-1
```

Entry emotion: Decisive. Exit emotion: Confident (deliberate, loud commitment).

### Step 4 -- History navigation: Alt+Left / Alt+Right

```
Navigation history stack (conceptual):

  [0] sub-tab=commands, item=release, split=closed
  [1] sub-tab=commands, item=release, split={ref=nw-bdd-req}        <- single-click (step 2)
  [2] sub-tab=commands, item=release, split={ref=pre-release.sh}    <- single-click replaced
  [3] sub-tab=skills,  item=nw-bdd-req, split=closed                <- Ctrl+click (step 3)  <- HEAD

Alt+Left from [3]  -> [2]  (sub-tab re-switches to commands, list re-selects release,
                            split reopens with pre-release.sh preview)
Alt+Left from [2]  -> [1]
Alt+Left from [1]  -> [0]
Alt+Left from [0]  -> no-op (subtle "at start of history" feedback, e.g. shake or toast)
Alt+Right from [2] -> [3]  (only available if user went back; forward is cleared by a
                            new navigation action)

What counts as a history entry:
  - Ctrl+click (replace + sync)             : YES, pushes entry
  - Single-click on reference (open split)  : YES, pushes entry
  - Single-click on reference inside split  : YES, pushes entry (replaces split target)
  - Closing the split (x or Esc)            : YES, pushes entry
  - Selecting an item from the LIST PANE    : see open question OQ-2
  - Switching sub-tab manually              : see open question OQ-2
  - Resize of the split divider             : NO, not a navigation event
```

Entry emotion: Lost or deliberate. Exit emotion: Reassured.

### Step 5 -- Dead reference handling

```
+-- Detail pane ----------------------------------------------------------+
| # /retired-command                                                       |
| ...                                                                      |
| See also: ~nw-old-skill-that-was-deleted~                                |
|           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^                                |
|           rendered as STRIKETHROUGH + MUTED                              |
|           on hover: cursor=not-allowed                                   |
|           tooltip: "Not found in your config.                            |
|                     Searched: user, project, plugin scopes."             |
|                                                                          |
| Click does nothing (no split, no history push).                          |
| Single-key Enter when focused shows the same tooltip as a popover.       |
+--------------------------------------------------------------------------+
```

Entry emotion: Hopeful. Exit emotion: Informed-not-frustrated (the UI explains, doesn't blame).

### Step 6 -- Ambiguous reference (same name in multiple scopes)

```
Scenario: word "release" appears in markdown; "release" exists as both
  - project-scope command (.claude/commands/release.md)
  - user-scope command (~/.claude/commands/release.md)

+-- Detail pane ----------------------------------------------------------+
| ...trigger the ~release~ command...                                      |
|                ^^^^^^^^^                                                 |
|                on hover shows small disambiguation chip:                 |
|                                                                          |
|                +-------------------------------------------+             |
|                | release -- 2 matches                      |             |
|                | > [project] Cuts a release                |             |
|                |   [user]    Generic release script        |             |
|                +-------------------------------------------+             |
|                                                                          |
| Click:   opens disambiguation popover (select which one, then split).    |
| Ctrl+click: opens disambiguation popover (select which one, then sync).  |
| Keyboard: Enter = popover, arrow keys to choose, Enter confirms.         |
+--------------------------------------------------------------------------+

Scope precedence fallback (if user presses Enter without choosing):
  project > plugin > user
  Rationale: most-local-wins, matches Claude Code resolution order.
  But UI still shows the chip so the user is aware of the ambiguity.
```

Entry emotion: Slightly confused. Exit emotion: In-control (choice was surfaced, not hidden).

---

## Keyboard Model

| Keystroke               | Action                                                   |
|-------------------------|----------------------------------------------------------|
| Tab                     | Move focus across reference tokens in current pane       |
| Shift+Tab               | Reverse tab order                                        |
| Enter (on focused ref)  | Same as single-click -- open split preview               |
| Ctrl+Enter (on ref)     | Same as Ctrl+click -- replace + sync primary             |
| Alt+Left                | History back (global within Config view)                 |
| Alt+Right               | History forward                                          |
| Esc (in split)          | Close split (equivalent to back when split is top of history) |
| Ctrl+L                  | Focus list pane (existing norbert-config shortcut, preserved) |

Scope of Alt+Left / Alt+Right: **Configuration view only**. They must not intercept when the Configuration tab is not the active Norbert view. When Norbert's top-level view is Sessions or Usage, Alt+Left/Right falls through to the OS or browser default.

---

## Shared Artifacts Crossing Steps

| Artifact                   | Source of truth                               | Consumers across steps |
|----------------------------|-----------------------------------------------|------------------------|
| `${reference_registry}`    | Plugin-maintained index of all config items by (type, scope, name) | Steps 1, 2, 3, 5, 6 (detection and resolution) |
| `${nav_history_stack}`     | Config-view-scoped state (in-memory, per-session) | Steps 2, 3, 4 |
| `${active_sub_tab}`        | ConfigListPanel controlled state               | Steps 1, 3, 4 (Ctrl+click writes it; history restores it) |
| `${selected_list_item}`    | ConfigListPanel controlled state               | Steps 1, 3, 4 (Ctrl+click writes it; history restores it) |
| `${split_state}`           | ConfigDetailPanel controlled state (`null` or `{topRef, bottomRef}`) | Steps 2, 3, 4 |
| `${reference_token_style}` | Design tokens (added in DESIGN wave)           | Steps 1, 5, 6 |
| `${scope_resolution_order}`| Constant: `project > plugin > user` (proposed) | Step 6 |

See `shared-artifacts-registry.md` for full registry with integration risk levels.

---

## Integration Checkpoints

1. **Reference detection parity**: Every reference detected during render MUST resolve to the same registry entry that a click-time lookup would produce. No race condition where a token renders clickable but resolves to nothing (beyond genuine deletion between render and click).
2. **History <-> UI state consistency**: After Alt+Left, the UI state (`active_sub_tab`, `selected_list_item`, `split_state`) MUST match exactly what it was when that history entry was pushed.
3. **Split depth cap**: Clicking a reference inside the bottom split REPLACES the bottom target; it NEVER creates a third pane. Enforced at state-update time.
4. **Ctrl+click full sync**: A Ctrl+click MUST always update all three of {sub-tab, list selection, detail}; partial updates (e.g., switching sub-tab but not scrolling list) are a bug.
5. **Keyboard reachability**: Every clickable reference token MUST be reachable by Tab and activatable by Enter / Ctrl+Enter.

---

## Changelog

- 2026-04-21: Initial journey created for feature `config-cross-references`.
