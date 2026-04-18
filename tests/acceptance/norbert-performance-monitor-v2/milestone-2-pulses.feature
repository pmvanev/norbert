Feature: Milestone 2 — Hook Event Pulses
  Hook events (tool calls, sub-agent spawns, lifecycle) arrive instantly and
  are visualized as bright flares on the originating session's trace at the
  event's arrival timestamp. Pulses decay linearly over a 2.5-second visual
  lifetime and are trimmed from the frame when stale.

  Background:
    Given the Performance Monitor view is open
    And the Y-axis metric is Events per second

  # --- Happy path scenarios ---

  @driving_port @US-PM-001
  Scenario: A fresh tool call pulse flares brightest at arrival
    Given session "session-1" has a steady events-per-second envelope
    And a tool call hook event arrives for "session-1" at the current moment
    When the scope projects the current frame
    Then the frame contains a pulse on "session-1" at the current time
    And the pulse's decay factor is at its maximum value

  @driving_port @US-PM-001
  Scenario: A mid-life pulse carries a decay factor proportional to its age
    Given session "session-1" has a steady events-per-second envelope
    And a tool call hook event arrived for "session-1" 1.25 seconds ago
    When the scope projects the current frame
    Then the frame contains a pulse on "session-1" at the 1.25-second-ago position
    And the pulse's decay factor reflects half of its 2.5-second lifetime

  @driving_port @US-PM-001
  Scenario: Pulse strength varies with event kind
    Given session "session-1" has a steady events-per-second envelope
    And a tool call hook event arrives for "session-1" at the current moment
    And a lifecycle hook event also arrives for "session-1" at the current moment
    When the scope projects the current frame
    Then the frame contains two pulses on "session-1"
    And the tool call pulse has greater strength than the lifecycle pulse

  @driving_port @US-PM-001
  Scenario: Three pulse kinds exhibit the full tool-subagent-lifecycle strength ordering
    Given session "session-1" has a steady events-per-second envelope
    And a tool call hook event arrives for "session-1" at the current moment
    And a sub-agent hook event also arrives for "session-1" at the current moment
    And a lifecycle hook event also arrives for "session-1" at the current moment
    When the scope projects the current frame
    Then the frame contains three pulses on "session-1"
    And the pulses are ordered by strength descending: tool, sub-agent, lifecycle

  @driving_port @US-PM-001
  Scenario: Multiple pulses coexist on a single session's trace
    Given session "session-1" has a steady events-per-second envelope
    And three tool call events arrived for "session-1" at 0.5, 1.0, and 2.0 seconds ago
    When the scope projects the current frame
    Then the frame contains three pulses on "session-1"
    And each pulse is positioned at its own arrival time
    And each pulse has a decay factor reflecting its own age

  # --- Error / boundary scenarios ---

  @driving_port @US-PM-001
  Scenario: A pulse older than 2.5 seconds is absent from the frame
    Given session "session-1" has a steady events-per-second envelope
    And a tool call hook event arrived for "session-1" 3 seconds ago
    When the scope projects the current frame
    Then the frame contains no pulse from that stale event for "session-1"

  @driving_port @US-PM-001
  Scenario: The store trims pulses older than the retention cutoff
    Given session "session-1" has pulses arriving continuously for 30 seconds
    When the store retains pulses for the configured retention duration only
    Then pulses older than 5 seconds are trimmed from the store
    And pulses younger than 5 seconds remain retained

  @driving_port @US-PM-001
  Scenario: A pulse references a session value from the same arrived history
    Given session "session-1" has an arrived rate of 10 events per second 1 second ago
    And a tool call hook event arrives for "session-1" 1 second ago
    When the scope projects the current frame
    Then the pulse's vertical position on the trace matches the arrived value at the pulse's time
    And the pulse value is not fabricated from any inter-arrival interpolation

  @driving_port @US-PM-001
  Scenario: A session with pulses but no arrived rate history produces pulses at baseline
    Given session "session-1" has just been added
    And no rate samples have arrived for "session-1"
    And a lifecycle hook event arrives for "session-1" at the current moment
    When the scope projects the current frame
    Then the frame contains a pulse on "session-1"
    And the pulse's vertical position reflects a zero-value baseline
    And no fabricated rate sample appears in "session-1"'s trace
