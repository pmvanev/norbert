@walking_skeleton @US-001 @JS-7
Feature: Walking Skeleton -- First Captured Event on Dashboard

  As a Claude Code power user installing Norbert for the first time,
  I want to see a captured event on the dashboard within 5 minutes of install,
  so I can confirm Norbert works and begin trusting it with my real workflows.

  Background:
    Given a clean test environment with no prior Norbert installation

  # ===================================================================
  # Walking Skeleton 1: First event flows through entire pipeline
  # Proves: hook -> server -> SQLite -> dashboard
  # ===================================================================

  @walking_skeleton
  Scenario: First event captured and displayed on dashboard
    Given Rafael has initialized Norbert on his machine
    And Norbert server is running and healthy
    When a tool call event arrives from a Claude Code session
    Then the dashboard displays at least 1 captured event
    And each event shows a timestamp, tool name, and status
    And the total time from initialization to seeing the event is under 5 minutes

  # ===================================================================
  # Walking Skeleton 2: CLI confirms pipeline is operational
  # Proves: hook -> server -> SQLite -> CLI query
  # ===================================================================

  @walking_skeleton
  Scenario: Status command confirms events are flowing through the pipeline
    Given Rafael has initialized Norbert on his machine
    And a tool call event has been captured
    When Rafael checks the observatory status
    Then the captured event count is greater than zero
    And at least 1 session is observed
    And the last event shows the tool name and time elapsed

  # ===================================================================
  # Hook Configuration -- Additive, Non-Destructive
  # ===================================================================

  Scenario: Existing hooks preserved during initialization
    Given Priya has 5 custom hooks already configured for her framework
    When Priya initializes Norbert
    Then Priya's 5 original hooks remain unchanged
    And 7 new Norbert hooks are appended to the configuration
    And both sets of hooks can fire independently during tool calls

  # ===================================================================
  # Error and Boundary Scenarios
  # ===================================================================

  @error
  Scenario: Port conflict handled gracefully with actionable message
    Given port 7890 is occupied by another process
    When Marcus attempts to initialize Norbert
    Then Norbert reports that port 7890 is already in use
    And suggests using an alternative port with the port flag
    And no hook configuration or database is created

  @error
  Scenario: Initialization is atomic -- no partial state on failure
    Given a simulated failure occurs during database creation
    When Rafael attempts to initialize Norbert
    Then no hook entries are written to the settings file
    And no partial database file exists
    And Rafael sees an error message with recovery steps

  @error
  Scenario: Server crash does not affect Claude Code operation
    Given Norbert server is running and capturing events
    When the Norbert server process crashes unexpectedly
    Then Claude Code continues operating without interruption
    And hook calls fail silently without blocking tool execution
    And Rafael can restart the server without data loss

  @error
  Scenario: Zero events guides user to troubleshooting
    Given Rafael has initialized Norbert
    But no Claude Code commands have been run since initialization
    When Rafael checks the observatory status
    Then the captured event count shows zero
    And a helpful message suggests running any Claude Code command
    And no error or failure state is displayed

  @edge
  Scenario: Initialization completes within performance target
    When Rafael initializes Norbert on a standard machine
    Then the entire initialization completes in under 30 seconds
