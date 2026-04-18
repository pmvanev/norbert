Feature: Performance Monitor v2 Phosphor Scope — Walking Skeletons
  As a Claude Code power user running concurrent sessions,
  I want a peripheral-vision live signal that answers "are my agents alive and churning?"
  So I can stay in flow on other work without context-switching to check.

  The Performance Monitor v2 renders per-session color traces on an overlaid
  phosphor scope, with event-pulse flares on hook arrivals and a user-toggleable
  Y-axis metric. Traces are projected from EWMA-smoothed rate history; pulses
  decay visually over 2.5s. No sub-interval interpolation; no zero-fill.

  Background:
    Given the Performance Monitor view is open
    And the Y-axis metric defaults to Events per second

  @walking_skeleton @driving_port @US-PM-001
  Scenario: User glances at the scope and sees two sessions alive and churning
    Given two sessions are active: "session-1" and "session-2"
    And "session-1" has received hook events over the last 30 seconds producing a non-zero events-per-second envelope
    And "session-2" has received hook events over the last 30 seconds producing a non-zero events-per-second envelope
    When the scope projects the current frame
    Then the frame contains one trace per active session
    And each trace carries the session's color identity
    And each trace samples its session's arrived rate history across the 60-second window
    And the legend lists each session with its latest events-per-second value

  @walking_skeleton @driving_port @US-PM-001
  Scenario: User sees a fresh hook event flare as a pulse on its session's trace
    Given session "session-1" has a steady events-per-second envelope
    And a tool call hook event arrives 1.2 seconds ago for "session-1"
    When the scope projects the current frame
    Then the frame contains a pulse entry on "session-1"'s trace
    And the pulse is positioned at the hook event's arrival time
    And the pulse has a decay factor reflecting its 1.2-second age against the 2.5-second lifetime
    And the pulse's session color matches "session-1"

  @walking_skeleton @driving_port @US-PM-001
  Scenario: User switches the metric and the scope re-projects with the new scale
    Given session "session-1" has arrived tokens-per-second history peaking near 80 tokens per second
    And the metric is currently Events per second with a Y-axis maximum of 15
    When the user selects Tokens per second
    Then the next projected frame uses the tokens-per-second history for "session-1"
    And the frame's Y-axis maximum reflects the tokens-per-second scale of 100
    And the persistence buffer is reset at the metric-change boundary

  @walking_skeleton @driving_port @US-PM-001
  Scenario: User hovers over a trace and a tooltip identifies the session, value, and age
    Given session "session-2" has an arrived rate of 47 events per second 1.5 seconds ago
    And the scope is showing the Events per second metric
    When the user moves the pointer close to "session-2"'s trace at the 1.5-seconds-ago position
    Then the hover selection identifies "session-2"
    And the hover selection reports the value 47 events per second
    And the hover selection reports the age as approximately 1.5 seconds ago
