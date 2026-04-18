Feature: Milestone 4 — Hover Tooltip
  Hovering over the scope snaps to the nearest trace within a vertical
  distance threshold and produces a selection identifying the session, its
  arrived value at the pointer's time, and the age of that value.
  Minimal content, no drill-down.

  Background:
    Given the Performance Monitor view is open
    And the Y-axis metric is Events per second

  # --- Happy path scenarios ---

  @driving_port @US-PM-001
  Scenario: Hover near a trace snaps to that session's nearest value
    Given two sessions are active with distinct traces
    And "session-1" shows an arrived rate of 12 events per second 2 seconds ago
    And the pointer is over "session-1"'s trace at the 2-second-ago position
    When the hover selection is computed for the pointer position
    Then the hover selection identifies "session-1"
    And the hover selection reports the value 12 events per second
    And the hover selection reports the age as approximately 2 seconds ago

  @driving_port @US-PM-001
  Scenario: Hover snaps to the nearest of two overlapping traces
    Given "session-1" and "session-2" have traces that cross near the current time
    And "session-1"'s trace is slightly closer to the pointer's vertical position than "session-2"'s
    When the hover selection is computed for the pointer position
    Then the hover selection identifies "session-1"
    And the hover selection does not identify "session-2"

  @driving_port @US-PM-001
  Scenario: Hover value comes from sampling the arrived history at the pointer's time
    Given "session-1" has arrived rate samples at 5-second intervals
    And the pointer is at a time between two arrived samples
    When the hover selection is computed for the pointer position
    Then the hover selection's value equals the arrived-history interpolation between those two samples
    And the hover selection's value matches the trace value at the same time position

  # --- Error / boundary scenarios ---

  @driving_port @US-PM-001
  Scenario: Hover beyond the snap threshold produces no selection
    Given "session-1" has a trace well below the pointer's vertical position
    And the vertical distance from the pointer to "session-1"'s trace exceeds the snap threshold
    When the hover selection is computed for the pointer position
    Then the hover selection is absent

  @driving_port @US-PM-001
  Scenario: Hover outside the scope area produces no selection
    Given the pointer is outside the scope's rectangular area
    When the hover selection is computed for the pointer position
    Then the hover selection is absent

  @driving_port @US-PM-001
  Scenario: Hover with no active sessions produces no selection
    Given no sessions are active
    And the pointer is inside the scope area
    When the hover selection is computed for the pointer position
    Then the hover selection is absent

  @driving_port @US-PM-001
  Scenario: Hover at the right edge reports an age near zero
    Given "session-1" has a recent arrived rate sample at the current moment
    And the pointer is at the right edge of the scope area over "session-1"'s trace
    When the hover selection is computed for the pointer position
    Then the hover selection's reported age is less than 0.5 seconds

  @driving_port @US-PM-001
  Scenario: Hover at the left edge reports an age near the window length
    Given "session-1" has arrived rate samples spanning the full 60-second window
    And the pointer is at the left edge of the scope area over "session-1"'s trace
    When the hover selection is computed for the pointer position
    Then the hover selection's reported age is approximately 60 seconds
