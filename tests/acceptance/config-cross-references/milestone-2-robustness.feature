Feature: Cross-Reference Navigation -- Milestone 2: Robustness
  Multi-pane invariants, soft-failure paths, and full keyboard parity.
  Covers US-106 (chained click invariants), US-109 (deleted-mid-click and
  permission-denied), and US-110 (keyboard-only end-to-end path).
  US-111 (R3 bare-prose toggle) is intentionally excluded -- the v1 architecture
  ships bare-prose detection OFF (ADR-010) and exposes no setting until R3.

  Background:
    Given Ravi is viewing the Configuration view in Norbert
    And the Configuration view is the active top-level view
    And the aggregated configuration has been loaded

  # =====================================================================
  # US-106 -- Multi-pane invariants in the open split
  # =====================================================================

  @milestone-2 @driving_port @pending
  Scenario: Click on a dead reference inside the bottom pane does not replace the bottom
    Given the detail pane is split with "/release" on top and skill "nw-bdd-requirements" on bottom
    And the bottom preview contains a dead reference token for "nw-deleted-skill"
    When Ravi single-clicks the dead reference inside the bottom pane
    Then the bottom pane still shows the preview of "nw-bdd-requirements"
    And the top pane still shows "/release"
    And no history entry is pushed

  @milestone-2 @driving_port @property @pending
  Scenario: For any sequence of single-clicks on live references, the split is always exactly 2 panes
    Given the detail pane is split with a top anchor item
    When any sequence of single-clicks on live references is performed in either pane
    Then the pane structure is always exactly one top pane and one bottom pane
    And the top pane reference is unchanged by any bottom-pane click
    And the top pane reference changes only on Ctrl+click or history traversal

  @milestone-2 @driving_port @property @pending
  Scenario: When the split is open the selected list item key always equals the top pane reference key
    Given any reachable Configuration view state in which the split is open
    Then the selected list item key equals the top pane reference's item key

  # =====================================================================
  # US-109 -- Deleted-mid-click and permission-denied soft failures
  # =====================================================================

  @milestone-2 @driving_port @infrastructure-failure @pending
  Scenario: Reference target deleted between render and click surfaces a soft-fail toast
    Given Ravi is viewing the command "/release"
    And the body contains a live reference to the hook "pre-release.sh"
    And between render and click the hook "pre-release.sh" is removed from the registry
    When Ravi single-clicks the reference to "pre-release.sh"
    Then the detail pane does not enter a split state
    And a soft-fail toast "This item was removed since the panel was loaded" is shown at the pane header
    And no unhandled exception is observed
    And on the next render the reference token for "pre-release.sh" appears as a dead reference

  @milestone-2 @driving_port @infrastructure-failure @pending
  Scenario: Permission denied at click time opens the split with a permission-denied panel
    Given Ravi is viewing the command "/release"
    And the body contains a live reference to a command whose source file cannot be read due to permissions
    When Ravi single-clicks the reference
    Then the detail pane is split
    And the bottom pane shows a "Permission denied" panel
    And the panel includes the target's name, type, scope, and file path
    And the panel exposes a "Retry" control
    And no unhandled exception is observed

  @milestone-2 @driving_port @infrastructure-failure @pending
  Scenario: Retry recovers the bottom pane after the user fixes permissions
    Given the bottom pane shows a "Permission denied" panel for a target command
    And the source file's permissions have since been fixed
    When Ravi activates the "Retry" control
    Then the bottom pane shows the normal preview of the target command

  @milestone-2 @driving_port @infrastructure-failure @pending
  Scenario: History navigation still works after a soft-failure
    Given Ravi has experienced a deleted-mid-click soft-fail on the reference to "pre-release.sh"
    And a prior cross-reference action exists in the history
    When Ravi presses Alt+Left
    Then the pre-soft-failure state is restored exactly

  # =====================================================================
  # US-110 -- Keyboard-only end-to-end path and focus management
  # =====================================================================

  @milestone-2 @driving_port @pending
  Scenario: Keyboard-only path peek then commit then back
    Given Ravi is viewing the command "/release" in sub-tab "commands"
    And the body contains a live reference to the user-scope skill "nw-bdd-requirements"
    When Ravi tab-focuses the live reference
    And presses Enter
    And presses Shift+Tab to return focus to the reference
    And presses Ctrl+Enter
    And presses Alt+Left
    Then after Enter the detail pane is split with "/release" on top and "nw-bdd-requirements" on bottom
    And after Ctrl+Enter the active sub-tab is "skills" and the list pane selection is "nw-bdd-requirements"
    And after Alt+Left the detail pane is split with "/release" on top and "nw-bdd-requirements" on bottom
    And keyboard focus lands on a sensible focal element at each step

  @milestone-2 @driving_port @pending
  Scenario: After Ctrl+click commit the focus moves to the new selected list row
    Given Ravi is viewing the command "/release" in sub-tab "commands"
    And the body contains a live reference to the user-scope skill "nw-bdd-requirements"
    When Ravi Ctrl+clicks the reference to "nw-bdd-requirements"
    Then keyboard focus moves to the list row for "nw-bdd-requirements"

  @milestone-2 @driving_port @pending
  Scenario: After disambiguation confirmation focus returns to the triggering reference token
    Given Ravi has tab-focused an ambiguous reference token
    And Ravi has opened the disambiguation popover by pressing Enter
    When Ravi presses Enter to confirm the pre-highlighted candidate
    Then keyboard focus returns to the triggering reference token

  @milestone-2 @driving_port @pending
  Scenario: Each pane transition is announced via the ARIA live region
    Given Ravi is viewing the command "/release" with a live reference to "nw-bdd-requirements"
    When Ravi single-clicks the reference to open the split
    And then clicks Close to collapse the split
    Then the announcements made include "Preview open: skill nw-bdd-requirements, user scope" then "Preview closed"

  @milestone-2 @driving_port @pending
  Scenario: Alt+Left is ignored while typing inside an input or textarea
    Given Ravi is typing in the filter bar input on sub-tab "commands"
    And the Configuration view's history has at least one entry
    When Ravi presses Alt+Left while focus is in the input
    Then the Configuration view's history head is unchanged
    And the input continues to receive the keystroke
