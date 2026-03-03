@skip @US-003 @JS-6 @JS-3
Feature: Dashboard Overview -- Sessions, MCP Health, and Key Metrics

  As a Claude Code power user opening the dashboard after a day of work,
  I want to see today's sessions, token costs, and MCP server health at a glance,
  so I can quickly understand what happened without drilling into individual sessions.

  Background:
    Given Norbert is running with captured session data

  # ===================================================================
  # Walking Skeleton: Overview page delivers at-a-glance value
  # ===================================================================

  @walking_skeleton
  Scenario: Dashboard overview answers "what happened today"
    Given Rafael completed 6 sessions today totaling 142,847 tokens
    And 4 MCP servers are connected with zero failures
    When Rafael opens the Norbert dashboard
    Then he sees a session count of 6
    And he sees a total token count of 142,847
    And he sees an estimated cost of approximately $4.28
    And he sees 4 MCP servers listed with their connection status

  # ===================================================================
  # Summary Cards
  # ===================================================================

  Scenario: Summary cards reflect accurate aggregated metrics
    Given 3 sessions today with costs of $0.50, $1.20, and $2.58
    When the dashboard overview loads
    Then the session count shows 3
    And the total estimated cost shows $4.28
    And the total token count reflects the sum across all 3 sessions

  # ===================================================================
  # Recent Sessions Table
  # ===================================================================

  Scenario: Recent sessions table sorted by newest first
    Given 6 sessions exist with varying start times
    When Rafael views the recent sessions table
    Then sessions are sorted by start time with the newest first
    And each row shows session start time, agent count, tokens, cost, and duration
    And clicking a session row navigates to its detail page

  Scenario: Session with highest cost is visually identifiable
    Given session 4 cost $2.02 and all other sessions cost under $0.70
    When Rafael views the recent sessions table
    Then session 4 stands out with cost $2.02
    And the table makes it easy to identify the most expensive session

  # ===================================================================
  # MCP Health Table
  # ===================================================================

  Scenario: MCP health table shows per-server status and metrics
    Given 4 MCP servers observed today: github, sentry, postgres, and omni-search
    And sentry had 3 errors with 94.2% uptime
    And omni-search has 14,214 tokens of tool description overhead
    When Rafael views the MCP server health table
    Then each server shows connection status, call count, and error count
    And sentry shows a warning indicator with 3 errors
    And omni-search shows its token overhead of 14,214 tokens

  Scenario: Total MCP token overhead displayed as summary
    Given 4 MCP servers with combined token overhead of 24,314 tokens
    When the MCP health table loads
    Then the total MCP token overhead shows 24,314 tokens

  # ===================================================================
  # Empty and Edge States
  # ===================================================================

  @error
  Scenario: Empty state on first visit with no captured data
    Given Norbert has been initialized but no sessions have been captured
    When Rafael opens the dashboard
    Then the sessions area shows "No sessions captured yet"
    And a guide explains how to start seeing data
    And the MCP health section shows a waiting message

  @edge
  Scenario: Dashboard with single session shows clean layout
    Given only 1 session exists with 3 events
    When Rafael opens the dashboard
    Then the overview displays the single session correctly
    And the layout does not appear broken or sparse

  # ===================================================================
  # Performance
  # ===================================================================

  @edge
  Scenario: Dashboard loads within performance target
    Given 100 sessions exist in the database
    When Rafael opens the dashboard
    Then the page loads completely in under 2 seconds

  # ===================================================================
  # CLI/Dashboard Parity
  # ===================================================================

  Scenario: CLI status matches dashboard overview counts
    Given 6 sessions and 47 events are captured today
    When Rafael checks the observatory status via command line
    And Rafael opens the dashboard overview
    Then the event count matches between CLI and dashboard
    And the session count matches between CLI and dashboard
