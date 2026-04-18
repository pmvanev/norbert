Feature: Milestone 5 — Session Lifecycle and Ambient Window
  Sessions are added and removed from the store as Claude Code sessions start
  and end. The scope reflects lifecycle changes in the next projected frame.
  The 60-second ambient window trims rate samples and pulses older than the
  window so the scope always shows only the recent past.

  Background:
    Given the Performance Monitor view is open
    And the Y-axis metric is Events per second

  # --- Happy path scenarios ---

  @driving_port @US-PM-001
  Scenario: Adding a session makes it appear on the scope in the next frame
    Given one session is active
    When a second session is added to the store
    And the scope projects its next frame
    Then the frame contains two traces
    And the legend lists both sessions

  @driving_port @US-PM-001
  Scenario: Removing a session makes it disappear from the scope in the next frame
    Given three sessions are active
    When the middle session is removed from the store
    And the scope projects its next frame
    Then the frame contains two traces
    And the removed session does not appear in the legend

  @driving_port @US-PM-001
  Scenario: The legend reflects the latest arrived value for each session
    Given "session-1" has arrived an events-per-second value of 7 most recently
    And "session-2" has arrived an events-per-second value of 22 most recently
    When the scope projects the current frame
    Then the legend shows "session-1" at 7 events per second
    And the legend shows "session-2" at 22 events per second

  # --- Error / boundary scenarios ---

  @driving_port @US-PM-001
  Scenario: Ambient 60-second window excludes samples older than the window
    Given "session-1" has arrived samples at 30, 45, 70, and 90 seconds ago
    When the scope projects the current frame
    Then "session-1"'s trace contains only the samples from within the last 60 seconds
    And samples older than 60 seconds are not projected

  @driving_port @US-PM-001
  Scenario: Pulses older than their retention are absent from the store
    Given "session-1" had a tool call pulse 6 seconds ago
    When the store is queried for "session-1"'s pulses
    Then the 6-second-old pulse is not present in the store
    And any pulses within the last 5 seconds are present in the store

  @driving_port @US-PM-001
  Scenario: Removing a session removes its associated rate buffers and pulses
    Given "session-1" has arrived rate history and pulses
    When "session-1" is removed from the store
    Then the store holds no rate buffers for "session-1"
    And the store holds no pulses for "session-1"
    And subsequent frames do not project "session-1"
