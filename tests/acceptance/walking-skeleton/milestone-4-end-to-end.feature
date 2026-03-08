Feature: End-to-End Proof -- Real session data visible in the Norbert window
  As a Claude Code power user who has installed Norbert,
  I want to see proof that my session activity has been captured,
  so I can trust that the full data pipeline is working.

  @skip
  Scenario: First session captured and displayed
    Given Priya has Norbert running with hooks registered
    And she starts a Claude Code session asking "Help me write a sorting function"
    And Claude Code makes 15 tool calls during the 8-minute session
    When the session ends
    And Priya opens the Norbert window
    Then the session count shows "1"
    And the event count shows "30"
    And the last session shows the correct start timestamp
    And the last session shows duration "8m 12s"
    And the empty state message is no longer visible

  @skip
  Scenario: Event count updates during an active session
    Given Priya has the Norbert window open during an active Claude Code session
    When Claude Code makes a tool call and Norbert receives the hook events
    Then the event count in the window increments within 1 second

  @skip
  Scenario: Status transitions between listening and active
    Given Norbert shows "Status: Listening" with no active session
    When a session start event arrives from Claude Code
    Then the status changes to "Active session"
    And when the session stop event arrives
    Then the status returns to "Listening"

  @skip
  Scenario: Multiple sessions accumulate correctly
    Given Priya has run 3 Claude Code sessions producing 5, 89, and 23 events
    When she opens the Norbert window
    Then the session count shows "3"
    And the total event count shows "117"
    And the most recent session's details are displayed

  @skip
  Scenario: Restart banner dismisses on first event
    Given the first-launch restart banner is visible in the Norbert window
    When the first hook event arrives from Claude Code
    Then the banner dismisses automatically
    And the banner does not reappear

  @skip
  Scenario: Tray icon reflects active session state
    Given Norbert is running and showing "Listening" status
    When the first hook event arrives from a Claude Code session
    Then the tray icon transitions to an active visual state
    And the tray tooltip shows the current event count

  @skip
  Scenario: Pre-restart events survive Norbert restart
    Given Norbert was receiving events from a Claude Code session
    And 20 events have been captured
    When Priya accidentally closes and relaunches Norbert
    Then the pre-restart events are still in the database
    And the hook receiver resumes accepting new events
    And the session record reflects all captured events

  @skip
  Scenario: Session with no tool calls shows zero events
    Given Priya starts a Claude Code session that ends immediately with no tool calls
    When only a session start and session stop event arrive
    Then the session count shows "1"
    And the session event count shows "2"
    And the session has a valid start timestamp and minimal duration
