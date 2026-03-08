Feature: Walking Skeleton -- Install Norbert and confirm data flows end-to-end
  As a Claude Code power user who spends money on AI sessions with no visibility,
  I want to install Norbert and see my session activity captured in a desktop window,
  so I can trust the platform before exploring its features.

  Background:
    Given Priya uses Claude Code daily for multi-agent development sessions
    And she has no current tool for observing what happens inside her sessions

  @walking_skeleton
  Scenario: First launch shows Norbert is alive and listening
    Given Priya has installed Norbert on her Windows 11 machine
    When she launches Norbert for the first time
    Then the Norbert icon appears in the system tray
    And the main window displays "NORBERT v0.1.0"
    And the status shows "Listening"
    And the port shows "3748"
    And the session count shows "0"
    And the event count shows "0"
    And the empty state message reads "Waiting for first Claude Code session..."

  @walking_skeleton
  Scenario: First session captured and visible in the window
    Given Priya has Norbert running with hooks registered
    And she starts a Claude Code session asking "Help me write a sorting function"
    And Claude Code makes 15 tool calls during the session
    When the session ends
    And Priya opens the Norbert window
    Then the session count shows "1"
    And the event count shows "30"
    And the last session shows the correct start timestamp
    And the last session shows duration "8m 12s"
    And the empty state message is no longer visible

  @walking_skeleton
  Scenario: Settings merge preserves existing Claude Code configuration
    Given Priya has an existing Claude Code configuration with custom permissions and MCP servers
    When Norbert performs the first-launch settings merge
    Then a backup of the original configuration is created
    And the backup is identical to the original
    And the merged configuration contains all of Priya's original settings
    And the merged configuration contains Norbert hook entries for 6 event types
    And each hook entry points to the Norbert receiver on port 3748
