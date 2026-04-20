Feature: Milestone 1 — Per-Session Rate Envelope Traces
  The scope renders one color trace per session, projected from that session's
  EWMA-smoothed rate history. Each trace preserves the session's color identity.
  No sub-interval interpolation. No zero-fill between arrivals.

  Background:
    Given the Performance Monitor view is open
    And the Y-axis metric is Events per second

  # --- Happy path scenarios ---

  @driving_port @US-PM-001
  Scenario: Each active session gets its own color identity on the scope
    Given three sessions are active: "session-1", "session-2", "session-3"
    And each session has arrived rate history across the 60-second window
    When the scope projects the current frame
    Then the frame contains three traces
    And each trace's session color is distinct from the others
    And each trace's session color remains stable across consecutive frames

  @driving_port @US-PM-001
  Scenario: A trace samples its session's arrived rate history across the window
    Given session "session-1" has arrived rate samples at 5-second intervals across the last 60 seconds
    And the most recent arrived sample is 12 events per second
    When the scope projects the current frame
    Then "session-1"'s trace carries sample values that only interpolate between arrived points
    And no trace value exceeds the maximum of its bracketing arrived samples
    And no trace value falls below the minimum of its bracketing arrived samples

  @driving_port @US-PM-001
  Scenario: A stalled session shows a flatline from the last arrived value, not a drop to zero
    Given session "session-1" had an arrived rate of 8 events per second 20 seconds ago
    And no events have arrived for "session-1" in the last 20 seconds
    When the scope projects the current frame
    Then "session-1"'s trace carries the value 8 events per second at the current-time edge
    And no point on "session-1"'s trace is zero while the last arrived value is non-zero

  # --- Error / boundary scenarios ---

  @driving_port @US-PM-001
  Scenario: A session with no arrived history yet produces an empty trace
    Given session "session-1" has just been added
    And no rate samples have arrived for "session-1"
    When the scope projects the current frame
    Then "session-1"'s trace carries no sample values
    And the legend shows "session-1" with a placeholder latest value

  @driving_port @US-PM-001
  Scenario: Samples older than the 60-second window are excluded from the trace
    Given session "session-1" has arrived rate samples spanning the last 120 seconds
    When the scope projects the current frame
    Then "session-1"'s trace only reflects samples within the last 60 seconds
    And no trace point uses a sample timestamped more than 60 seconds ago

  @driving_port @US-PM-001
  Scenario: Five concurrent sessions each receive a distinct color from the palette
    Given five sessions are active: "session-1", "session-2", "session-3", "session-4", "session-5"
    And each session has arrived rate history
    When the scope projects the current frame
    Then five traces appear in the frame
    And all five session colors are distinct
    And each color comes from the palette of rose, violet, emerald, amber, and sky

  @driving_port @US-PM-001
  Scenario: No active sessions yields an empty scope with a clear legend
    Given no sessions are active
    When the scope projects the current frame
    Then the frame contains no traces
    And the legend is empty
    And the Y-axis maximum still reflects the current metric's scale

  @driving_port @US-PM-001
  Scenario: Hiding a session via the legend omits its trace and pulses from the frame
    Given two sessions are active: "session-1", "session-2"
    And each session has arrived rate history
    When the scope projects the current frame with "session-1" hidden
    Then only "session-2"'s trace appears in the frame
    And "session-1" still appears in the legend marked as hidden
    And "session-2" still appears in the legend marked as visible
