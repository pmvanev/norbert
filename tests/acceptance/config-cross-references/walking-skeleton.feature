Feature: Cross-Reference Navigation -- Walking Skeleton (R1)
  As Ravi, a Claude Code power user reading one configuration item,
  I want to follow references to other items and come back without losing my place,
  so I can build a mental model of how my configs compose.

  This walking skeleton covers R1 stories US-101, US-102, US-103, US-104, US-107
  and the Close-button + Esc collapse from US-105 (pulled into R1 per DESIGN
  architecture.md section 11 to keep the split mechanism coherent on day 1).

  Background:
    Given Ravi is viewing the Configuration view in Norbert
    And the Configuration view is the active top-level view
    And the aggregated configuration has been loaded

  # =====================================================================
  # US-101 -- Reference detection and styling
  # =====================================================================

  @walking_skeleton @driving_port @kpi
  Scenario: Markdown link to a known skill renders as a live cross-reference token
    Given Ravi is reading the command "/release" in sub-tab "commands"
    And the command body contains the markdown link "[nw-bdd-requirements](~/.claude/skills/nw-bdd-requirements/SKILL.md)"
    And a skill named "nw-bdd-requirements" exists in user scope
    When the detail pane renders
    Then the link "nw-bdd-requirements" appears as a live cross-reference token
    And the token is keyboard-focusable
    And the token carries data identifying its target as the user-scope skill "nw-bdd-requirements"

  @walking_skeleton @driving_port @pending
  Scenario: Inline code matching a known agent renders as a live cross-reference token
    Given Ravi is reading the agent "nw-product-owner"
    And the body contains the inline code span "`nw-solution-architect`"
    And an agent named "nw-solution-architect" exists in project scope
    When the detail pane renders
    Then the inline code "nw-solution-architect" appears as a live cross-reference token
    And the inline code "`ls -la`" remains plain inline code

  @walking_skeleton @driving_port @pending
  Scenario: Content inside fenced code blocks is never linkified
    Given Ravi is reading a command whose body has a fenced code block
    And that fenced block contains the text "nw-bdd-requirements"
    And a skill named "nw-bdd-requirements" exists in user scope
    When the detail pane renders
    Then the occurrence inside the fenced block is plain code text
    And no cross-reference token is rendered for that occurrence

  @walking_skeleton @driving_port @pending
  Scenario: Bare prose is not detected as a reference in v1
    Given Ravi is reading a command whose body contains the bare word "release" in prose
    And a command named "release" exists in project scope
    When the detail pane renders
    Then the bare word "release" remains plain prose
    And no cross-reference token is rendered for that occurrence

  @walking_skeleton @driving_port @pending
  Scenario: Reference to a missing item renders as a dead token
    Given Ravi is reading the command "/old-release"
    And the body contains the markdown link "[nw-retired-skill](~/.claude/skills/nw-retired-skill/SKILL.md)"
    And no item named "nw-retired-skill" exists in any scope
    When the detail pane renders
    Then the token "nw-retired-skill" appears as a dead cross-reference token
    And the token exposes a tooltip naming the searched scopes "user, project, plugin"

  @walking_skeleton @driving_port @pending
  Scenario: Reference resolving to multiple items renders as an ambiguous token
    Given Ravi is reading a command whose body contains the inline code "`release`"
    And a command named "release" exists in project scope
    And a command named "release" exists in user scope
    When the detail pane renders
    Then the token "release" appears as an ambiguous cross-reference token
    And the token displays a candidate count of 2

  @walking_skeleton @driving_port @pending
  Scenario: Reference to an unsupported item type renders as an unsupported token
    Given Ravi is reading a command whose body contains the markdown link "[unknown thing](~/.claude/unknown-kind/foo.bin)"
    And no item type known to the plugin matches the path "~/.claude/unknown-kind/foo.bin"
    When the detail pane renders
    Then the token "unknown thing" appears as an unsupported cross-reference token
    And the token exposes a tooltip naming the path "~/.claude/unknown-kind/foo.bin" and the reason it is unsupported

  @walking_skeleton @driving_port @pending
  Scenario: Loading state with no aggregated configuration renders no tokens and no crash
    Given Norbert has not finished loading the aggregated configuration yet
    When the detail pane renders for any item
    Then the reference registry is empty
    And no cross-reference tokens are rendered
    And no error is shown

  # =====================================================================
  # US-102 -- Single-click peek (vertical split)
  # =====================================================================

  @walking_skeleton @driving_port @kpi
  Scenario: Single-click on a live reference opens a vertical split with the target previewed
    Given Ravi is viewing the command "/release" in sub-tab "commands"
    And the detail pane is a single pane
    And the body contains a live reference to the user-scope skill "nw-bdd-requirements"
    When Ravi single-clicks the reference to "nw-bdd-requirements"
    Then the detail pane is split with "/release" on top and "nw-bdd-requirements" preview on bottom
    And the list pane selection remains "/release" in sub-tab "commands"
    And one history entry is pushed
    And the announcement "Preview open: skill nw-bdd-requirements, user scope" is made

  @walking_skeleton @driving_port @pending
  Scenario: Keyboard Enter on a focused live reference behaves as single-click
    Given Ravi is viewing the command "/release" with a live reference to "nw-bdd-requirements" focused
    And the detail pane is a single pane
    When Ravi presses Enter
    Then the detail pane is split with "/release" on top and "nw-bdd-requirements" preview on bottom
    And one history entry is pushed

  # US-106 (R2) scenarios pulled into walking skeleton because the max-split-depth
  # invariant is architecturally load-bearing for US-102. See test-scenarios.md.
  @walking_skeleton @driving_port @pending
  Scenario: Single-click in an open split replaces the bottom pane only
    Given the detail pane is split with "/release" on top and skill "nw-bdd-requirements" on bottom
    And the top pane contains a live reference to the hook "pre-release.sh"
    When Ravi single-clicks the reference to "pre-release.sh"
    Then the bottom pane shows the preview of "pre-release.sh"
    And the top pane still shows "/release"
    And the pane structure is exactly one top pane and one bottom pane
    And one history entry is pushed

  # US-106 (R2) scenarios pulled into walking skeleton because the max-split-depth
  # invariant is architecturally load-bearing for US-102. See test-scenarios.md.
  @walking_skeleton @driving_port @pending
  Scenario: Single-click in the bottom pane replaces the bottom pane and preserves the top anchor
    Given the detail pane is split with "/release" on top and skill "nw-bdd-requirements" on bottom
    And the bottom preview contains a live reference to skill "nw-discovery-methodology"
    When Ravi single-clicks the reference to "nw-discovery-methodology" inside the bottom pane
    Then the bottom pane shows the preview of "nw-discovery-methodology"
    And the top pane still shows "/release"
    And the pane structure is exactly one top pane and one bottom pane

  # =====================================================================
  # US-103 -- Ctrl+click commit (replace + sync primary panel)
  # =====================================================================

  @walking_skeleton @driving_port @kpi
  Scenario: Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update
    Given Ravi is viewing the command "/release" in sub-tab "commands"
    And the body contains a live reference to the user-scope skill "nw-bdd-requirements"
    When Ravi Ctrl+clicks the reference to "nw-bdd-requirements"
    Then the active sub-tab is "skills"
    And the list pane selection is "nw-bdd-requirements"
    And the detail pane shows "nw-bdd-requirements" in a single pane
    And one history entry is pushed
    And the active sub-tab, list selection, and detail pane are all consistent with the target in the same rendered frame
    And the announcement "Switched to skills; now viewing skill nw-bdd-requirements" is made

  @walking_skeleton @driving_port @pending
  Scenario: Ctrl+click within the same sub-tab swaps only the list selection and detail
    Given Ravi is viewing the skill "nw-bdd-requirements" in sub-tab "skills"
    And the body contains a live reference to the project-scope skill "nw-discovery-methodology"
    When Ravi Ctrl+clicks the reference to "nw-discovery-methodology"
    Then the active sub-tab remains "skills"
    And the list pane selection is "nw-discovery-methodology"
    And the detail pane shows "nw-discovery-methodology" in a single pane
    And one history entry is pushed

  @walking_skeleton @driving_port @pending
  Scenario: Ctrl+click closes any open split as part of the commit
    Given the detail pane is split with "/release" on top and skill "nw-bdd-requirements" on bottom
    And the top pane contains a live reference to the hook "pre-release.sh"
    When Ravi Ctrl+clicks the reference to "pre-release.sh"
    Then the active sub-tab is "hooks"
    And the list pane selection is "pre-release.sh"
    And the detail pane shows "pre-release.sh" in a single pane
    And the split is closed

  @walking_skeleton @driving_port @pending
  Scenario: Keyboard Ctrl+Enter on a focused live reference behaves as Ctrl+click
    Given Ravi is viewing the command "/release" with a live reference to "nw-bdd-requirements" focused
    When Ravi presses Ctrl+Enter
    Then the active sub-tab is "skills"
    And the list pane selection is "nw-bdd-requirements"
    And the detail pane shows "nw-bdd-requirements" in a single pane

  @walking_skeleton @driving_port @pending
  Scenario: Ctrl+click preserves a filter that already shows the target
    Given Ravi has a filter on sub-tab "skills" set to source "user"
    And the user-scope skill "nw-bdd-requirements" exists
    And Ravi is viewing the command "/release" in sub-tab "commands"
    When Ravi Ctrl+clicks the reference to user-scope skill "nw-bdd-requirements"
    Then the active sub-tab is "skills"
    And the filter on sub-tab "skills" remains source "user"
    And no filter-cleared cue is shown

  @walking_skeleton @driving_port @pending
  Scenario: Ctrl+click resets the destination filter when it would hide the target
    Given Ravi has a filter on sub-tab "skills" set to source "project"
    And the user-scope skill "nw-bdd-requirements" exists
    And Ravi is viewing the command "/release" in sub-tab "commands"
    When Ravi Ctrl+clicks the reference to user-scope skill "nw-bdd-requirements"
    Then the active sub-tab is "skills"
    And the filter on sub-tab "skills" is cleared
    And the cue "Filter cleared to show target" is shown

  # =====================================================================
  # US-104 -- Alt+Left and Alt+Right traverse navigation history
  # =====================================================================

  @walking_skeleton @driving_port @kpi
  Scenario: Alt+Left restores the previous navigation snapshot
    Given Ravi has performed a single-click that opened the split with "/release" on top and "nw-bdd-requirements" on bottom
    And Ravi has then Ctrl+clicked through to the user-scope skill "nw-bdd-requirements" in sub-tab "skills"
    When Ravi presses Alt+Left
    Then the active sub-tab is "commands"
    And the list pane selection is "/release"
    And the detail pane is split with "/release" on top and "nw-bdd-requirements" on bottom
    And the restored state matches the previous history snapshot exactly

  @walking_skeleton @driving_port @pending
  Scenario: Alt+Right re-advances after going back
    Given Ravi has gone back one step via Alt+Left to the split state on "/release"
    When Ravi presses Alt+Right
    Then the active sub-tab is "skills"
    And the list pane selection is "nw-bdd-requirements"
    And the restored state matches the next history snapshot exactly

  @walking_skeleton @driving_port @pending
  Scenario: A new cross-reference action after Alt+Left clears the forward stack
    Given Ravi has gone back one step via Alt+Left
    And the forward history is non-empty
    When Ravi single-clicks a new live reference
    Then the previously-discarded forward entries no longer exist
    And the new state is the head of history
    And Alt+Right is no longer available

  @walking_skeleton @driving_port @pending
  Scenario: Alt+Left at the start of history is a no-op with end-of-history cue
    Given Ravi has not performed any cross-reference actions yet
    When Ravi presses Alt+Left
    Then no state changes occur
    And the end-of-history cue is shown for the back direction
    And the announcement "No further history in back direction" is made

  @walking_skeleton @driving_port @pending
  Scenario: Alt+Right at the end of history is a no-op with end-of-history cue
    Given Ravi is at the most recent navigation snapshot with no forward entries
    When Ravi presses Alt+Right
    Then no state changes occur
    And the end-of-history cue is shown for the forward direction
    And the announcement "No further history in forward direction" is made

  @walking_skeleton @driving_port @pending
  Scenario: Alt+Left does not act when another top-level view is active
    Given the active top-level view is "sessions"
    And the Configuration view's history has at least one entry
    When Ravi presses Alt+Left
    Then the Configuration view's history head is unchanged
    And no Configuration view state changes occur

  @walking_skeleton @driving_port @pending
  Scenario: Manual list-row selection does not push a history entry
    Given Ravi is viewing sub-tab "commands" with no reference clicks yet
    When Ravi selects the list row for "/release" manually
    Then the history stack remains empty

  @walking_skeleton @driving_port @pending
  Scenario: Manual sub-tab switch does not push a history entry
    Given Ravi is viewing sub-tab "commands" with no reference clicks yet
    When Ravi switches the sub-tab to "skills" manually
    Then the history stack remains empty

  @walking_skeleton @driving_port @property @pending
  Scenario: For any sequence of navigation actions the history never exceeds 50 entries
    Given a fresh Configuration view session
    When any sequence of cross-reference actions is performed
    Then the history stack length is always less than or equal to 50
    And the head index is always within the bounds of the history entries

  # =====================================================================
  # US-107 -- Dead references are non-interactive and self-explanatory
  # =====================================================================

  @walking_skeleton @driving_port @pending
  Scenario: Single-click on a dead reference is a complete no-op
    Given Ravi is viewing the command "/old-release"
    And the body contains a dead reference token for "nw-retired-skill"
    When Ravi single-clicks the dead reference
    Then the detail pane remains a single pane
    And the list pane selection is unchanged
    And no history entry is pushed

  @walking_skeleton @driving_port @pending
  Scenario: Ctrl+click on a dead reference is a complete no-op
    Given Ravi is viewing the command "/old-release"
    And the body contains a dead reference token for "nw-retired-skill"
    When Ravi Ctrl+clicks the dead reference
    Then the active sub-tab is unchanged
    And the list pane selection is unchanged
    And the detail pane is unchanged
    And no history entry is pushed

  @walking_skeleton @driving_port @pending
  Scenario: Dead reference exposes its tooltip on keyboard focus
    Given the body contains a dead reference token for "nw-retired-skill"
    When Ravi tab-focuses the dead reference
    Then the tooltip "Not found in your config. Searched: user, project, plugin scopes." is exposed to assistive technology

  # =====================================================================
  # US-105 (R1 pull-forward) -- Close button and Esc collapse the split
  # =====================================================================

  @walking_skeleton @driving_port @pending
  Scenario: Close button collapses the split back to a single pane
    Given the detail pane is split with "/release" on top and skill "nw-bdd-requirements" on bottom
    When Ravi clicks the Close button in the bottom pane header
    Then the detail pane is a single pane showing "/release"
    And one history entry is pushed
    And the announcement "Preview closed" is made

  @walking_skeleton @driving_port @pending
  Scenario: Esc with focus inside the split collapses the split back to a single pane
    Given the detail pane is split with "/release" on top and skill "nw-bdd-requirements" on bottom
    And keyboard focus is inside the bottom pane
    When Ravi presses Esc
    Then the detail pane is a single pane showing "/release"
    And one history entry is pushed

  @walking_skeleton @driving_port @pending
  Scenario: Esc with no split open is not intercepted by this feature
    Given the detail pane is a single pane
    When Ravi presses Esc
    Then no Configuration view state changes occur
    And no history entry is pushed
