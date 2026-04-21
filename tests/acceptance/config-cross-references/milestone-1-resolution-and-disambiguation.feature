Feature: Cross-Reference Navigation -- Milestone 1: Resolution and Disambiguation
  Ambiguous references always surface the disambiguation popover (US-108) so the
  user explicitly confirms a scope choice -- no silent precedence resolution.

  Background:
    Given Ravi is viewing the Configuration view in Norbert
    And the Configuration view is the active top-level view
    And the aggregated configuration has been loaded

  # =====================================================================
  # US-108 -- Ambiguous reference disambiguation popover
  # =====================================================================

  @milestone-1 @driving_port @kpi @pending
  Scenario: Single-click on an ambiguous reference opens the disambiguation popover
    Given Ravi is viewing a command whose body contains an ambiguous reference to "release"
    And a command "release" exists in project scope
    And a command "release" exists in user scope
    When Ravi single-clicks the ambiguous reference
    Then a disambiguation popover is opened near the reference token
    And the popover lists 2 candidates each with a scope badge
    And the project-scope candidate is the pre-highlighted candidate
    And no navigation has occurred and no history entry is pushed

  @milestone-1 @driving_port @pending
  Scenario: Disambiguation popover pre-highlights project over plugin over user
    Given Ravi is viewing a command whose body contains an ambiguous reference to "release"
    And a command "release" exists in project scope
    And a command "release" exists in plugin scope from plugin "release-tools"
    And a command "release" exists in user scope
    When Ravi single-clicks the ambiguous reference
    Then the disambiguation popover lists 3 candidates
    And the pre-highlighted candidate is the project-scope command "release"

  @milestone-1 @driving_port @pending
  Scenario: When no project candidate exists the plugin-scope candidate is pre-highlighted
    Given Ravi is viewing a command whose body contains an ambiguous reference to "release"
    And a command "release" exists in plugin scope from plugin "release-tools"
    And a command "release" exists in user scope
    When Ravi single-clicks the ambiguous reference
    Then the pre-highlighted candidate is the plugin-scope command "release" from plugin "release-tools"

  @milestone-1 @driving_port @pending
  Scenario: Confirming the pre-highlighted candidate with Enter applies single-click semantics
    Given the disambiguation popover is open with the project-scope command "release" pre-highlighted
    And the popover was triggered by a single-click
    When Ravi presses Enter without changing the highlight
    Then the detail pane is split with the source item on top and the project-scope "release" preview on bottom
    And one history entry is pushed
    And the popover is closed

  @milestone-1 @driving_port @pending
  Scenario: Arrow Down moves the highlight to the next candidate
    Given the disambiguation popover is open with the project-scope command "release" pre-highlighted
    And the popover lists project, plugin, and user candidates in that order
    When Ravi presses ArrowDown
    Then the highlighted candidate is the plugin-scope command "release"

  @milestone-1 @driving_port @pending
  Scenario: Arrow Up moves the highlight to the previous candidate
    Given the disambiguation popover is open with the plugin-scope command "release" highlighted
    And the popover lists project, plugin, and user candidates in that order
    When Ravi presses ArrowUp
    Then the highlighted candidate is the project-scope command "release"

  @milestone-1 @driving_port @pending
  Scenario: Confirming a non-default candidate applies single-click semantics to that candidate
    Given the disambiguation popover is open with project-scope pre-highlighted
    And the popover was triggered by a single-click
    When Ravi presses ArrowDown to highlight the user-scope command "release"
    And presses Enter
    Then the detail pane is split with the source item on top and the user-scope "release" preview on bottom
    And one history entry is pushed

  @milestone-1 @driving_port @pending
  Scenario: Confirming through a Ctrl+click-triggered popover applies Ctrl+click semantics
    Given Ravi has Ctrl+clicked the ambiguous reference "release"
    And the disambiguation popover is open with project-scope pre-highlighted
    When Ravi presses Enter
    Then the active sub-tab is "commands"
    And the list pane selection is the project-scope command "release"
    And the detail pane shows the project-scope command "release" in a single pane
    And one history entry is pushed

  @milestone-1 @driving_port @kpi @pending
  Scenario: Esc cancels the disambiguation popover with no side effects
    Given the disambiguation popover is open
    When Ravi presses Esc
    Then the popover is closed
    And the detail pane is unchanged
    And the active sub-tab is unchanged
    And the list pane selection is unchanged
    And no history entry is pushed

  @milestone-1 @driving_port @pending
  Scenario: Disambiguation popover is announced to assistive technology when opened
    Given Ravi is viewing a command whose body contains an ambiguous reference to "release"
    And the reference resolves to 2 candidates
    When Ravi single-clicks the ambiguous reference
    Then the announcement "Disambiguation required: 2 candidates for release" is made
    And the popover has the role "dialog"

  @milestone-1 @driving_port @pending
  Scenario: Tab inside the open disambiguation popover keeps focus within the popover
    Given the disambiguation popover is open with the project-scope command "release" pre-highlighted
    And the popover lists 2 candidates
    When Ravi presses Tab from the first candidate
    Then keyboard focus moves to the next candidate
    And keyboard focus remains within the popover dialog

  @milestone-1 @driving_port @pending
  Scenario: Shift+Tab from the first candidate wraps focus within the popover
    Given the disambiguation popover is open with the first candidate focused
    When Ravi presses Shift+Tab
    Then keyboard focus moves to either the last candidate or the cancel control per design
    And keyboard focus remains within the popover dialog

  @milestone-1 @driving_port @property @pending
  Scenario: For any ambiguous reference, the popover always opens regardless of trigger
    Given any ambiguous reference with 2 or more candidates
    When the user single-clicks, Ctrl+clicks, presses Enter, or presses Ctrl+Enter on the reference
    Then the disambiguation popover is opened
    And no navigation has occurred until the user confirms a candidate
