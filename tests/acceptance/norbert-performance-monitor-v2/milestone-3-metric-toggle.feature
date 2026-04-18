Feature: Milestone 3 — Metric Toggle
  The user toggles the Y-axis metric between Events per second, Tokens per
  second, and Tool-calls per second. Each metric has its own Y-axis scale,
  unit, and per-session arrived history. At the toggle boundary the
  persistence buffer is reset so afterglow from the prior metric cannot
  mislead at the new scale.

  Background:
    Given the Performance Monitor view is open

  # --- Happy path scenarios ---

  @driving_port @US-PM-001
  Scenario: Default metric at first launch is Events per second
    Given the Performance Monitor view opens for the first time
    When the scope projects its first frame
    Then the frame's metric is Events per second
    And the Y-axis maximum reflects the events-per-second scale of 15

  @driving_port @US-PM-001
  Scenario: Switching to Tokens per second re-projects with the tokens scale
    Given session "session-1" has arrived tokens-per-second history
    And the current metric is Events per second
    When the user selects Tokens per second
    Then the next projected frame uses tokens-per-second history
    And the frame's Y-axis maximum reflects the tokens-per-second scale of 100
    And the frame's unit label reflects tokens per second

  @driving_port @US-PM-001
  Scenario: Switching to Tool-calls per second re-projects with the tool-calls scale
    Given session "session-1" has arrived tool-calls-per-second history
    And the current metric is Events per second
    When the user selects Tool-calls per second
    Then the next projected frame uses tool-calls-per-second history
    And the frame's Y-axis maximum reflects the tool-calls-per-second scale of 3
    And the frame's unit label reflects tool calls per second

  # --- Boundary / honest-signal scenarios ---

  @driving_port @US-PM-001
  Scenario: Persistence buffer is reset at the metric-change boundary
    Given session "session-1" has arrived Events per second history and no Tokens per second history
    And the scope has projected a frame under the Events per second metric
    When the user selects Tokens per second
    Then the next projected frame uses the Tokens per second metric's Y-axis scale
    And the next projected frame's Y-axis scale is not the Events per second scale
    And the next projected frame contains no sample values carried over from the prior Events per second history
    And "session-1"'s trace in the next projected frame carries no sample values in the new metric

  @driving_port @US-PM-001
  Scenario: Toggling back to the original metric re-projects from its own history
    Given session "session-1" has arrived history for both Events per second and Tokens per second
    And the user has just switched to Tokens per second
    When the user switches back to Events per second
    Then the next projected frame uses events-per-second history for "session-1"
    And the frame's Y-axis maximum reflects the events-per-second scale of 15

  # --- Error scenarios ---

  @driving_port @US-PM-001
  Scenario: A session with history for one metric but not another projects an empty trace after toggle
    Given session "session-1" has arrived events-per-second history but no tokens-per-second history
    And the current metric is Events per second
    When the user selects Tokens per second
    Then the next projected frame contains "session-1"
    And "session-1"'s trace carries no sample values in the new metric
    And the legend shows "session-1" with a placeholder latest value

  @driving_port @US-PM-001
  Scenario: Hover is cleared when the metric changes
    Given session "session-1" has arrived Events per second history and no Tokens per second history
    And the user's pointer position hovers over "session-1"'s trace on the Events per second scale
    And a hover selection identifying "session-1" is present on the Events per second frame
    When the user selects Tokens per second
    Then the same pointer position on the next projected frame identifies no hovered session
    And the next hover requires a new pointer event on the Tokens per second scale
