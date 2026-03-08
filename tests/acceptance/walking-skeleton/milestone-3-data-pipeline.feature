Feature: Data Pipeline -- Settings merge, hook receiver, and database initialization
  As a Claude Code power user with existing custom configuration,
  I want Norbert to safely register hooks, start receiving events, and store them locally,
  so I can begin capturing session data without risking my existing setup.

  # --- Settings Merge ---

  @skip
  Scenario: Settings merge preserves existing configuration
    Given Priya has a Claude Code configuration with these settings:
      | setting      | value                                          |
      | permissions  | allow Read and Write                           |
      | mcpServers   | github (stdio, mcp-github)                     |
    When Norbert performs the first-launch settings merge
    Then a backup of the original configuration is created
    And the backup is byte-identical to the original
    And the merged configuration retains Priya's permissions and MCP servers
    And the merged configuration contains Norbert hook entries for these event types:
      | event_type       |
      | PreToolUse       |
      | PostToolUse      |
      | SubagentStop     |
      | Stop             |
      | SessionStart     |
      | UserPromptSubmit |
    And each hook entry URL points to "localhost" on port "3748"
    And each hook entry is configured for non-blocking delivery

  @skip
  Scenario: First launch with no existing configuration
    Given Priya has no existing Claude Code configuration file
    When Norbert performs the first-launch settings merge
    Then a new configuration is created with hook entries only
    And no backup file is created
    And the application starts normally

  @skip
  Scenario: Settings merge fails safely on malformed configuration
    Given Priya has a Claude Code configuration file containing invalid content
    When Norbert attempts the first-launch settings merge
    Then the malformed configuration is not modified
    And no backup file is created
    And a warning notifies Priya that hooks could not be registered automatically
    And the main window shows "Status: Listening (hooks not registered)"
    And the hook receiver and database still initialize correctly

  @skip @property
  Scenario: Settings merge is idempotent
    Given Norbert has already merged hooks into the configuration
    When Norbert performs the settings merge again
    Then the configuration is unchanged
    And no duplicate hook entries are created

  @skip
  Scenario: Restart notification appears after successful merge
    Given Norbert has successfully merged hooks into the configuration
    When the merge completes
    Then a notification tells Priya to restart any running Claude Code sessions
    And a persistent banner in the Norbert window shows the same message
    And the banner remains visible until the first hook event arrives

  # --- Database Initialization ---

  @skip
  Scenario: Database initializes with correct storage mode
    Given Priya launches Norbert for the first time
    When the application initializes
    Then the Norbert database is created in the data directory
    And the database uses write-ahead logging for concurrent access
    And the database contains a sessions table
    And the database contains an events table

  # --- Hook Receiver ---

  @skip
  Scenario: Hook receiver accepts and stores events
    Given Norbert is running with the hook receiver started
    When a Claude Code hook event of type "PreToolUse" arrives with a valid payload
    Then the event is acknowledged successfully
    And the event payload is stored with the correct event type
    And the event is attributed to the originating session

  @skip
  Scenario: Hook receiver rejects unknown event types
    Given Norbert is running with the hook receiver started
    When a hook event with an unrecognized event type arrives
    Then the event is rejected with an appropriate error
    And nothing is stored in the database

  @skip
  Scenario: Port unavailable prevents hook receiver startup
    Given another application is already using port 3748
    When Priya launches Norbert
    Then an error message explains that the hook receiver port is unavailable
    And the main window shows "Status: Error - port unavailable"
    And the tray icon indicates an error state

  @skip @property
  Scenario: Every acknowledged event is persisted before acknowledgment
    Given Norbert is running and receiving hook events
    When a hook event arrives and is acknowledged
    Then the event has been persisted to storage before the acknowledgment was sent
    And the stored event count always matches the number of acknowledged events
