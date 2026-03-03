@skip @US-005 @JS-3
Feature: MCP Health Dashboard -- Connectivity, Errors, and Diagnostics

  As a Claude Code power user with multiple MCP servers connected,
  I want to see which servers failed, when they disconnected, and why,
  so I can fix connection issues and resume work without spending 30 minutes guessing.

  Background:
    Given Norbert is running with MCP event data captured

  # ===================================================================
  # Walking Skeleton: MCP health panel shows server status
  # ===================================================================

  @walking_skeleton
  Scenario: MCP health panel shows connection status for all servers
    Given Rafael has 4 MCP servers and github disconnected at 14:23
    When Rafael opens the MCP health dashboard
    Then github shows status "disconnected" with a failure indicator
    And the other 3 servers show "connected" with healthy status
    And the disconnection time of 14:23 is visible for github

  # ===================================================================
  # Error Timeline and Diagnostics
  # ===================================================================

  Scenario: Server failure shows error timeline with diagnostic details
    Given github MCP server disconnected due to a connection timeout after 30 seconds
    When Rafael views the github server detail
    Then the error detail shows "Connection timeout after 30s"
    And a recommendation suggests checking server process health
    And the timeline shows the exact disconnection timestamp

  Scenario: Progressive latency degradation detected and visualized
    Given sentry MCP server showed latencies of 1.2s, 3.8s, then timeout across 3 calls
    When Priya views the sentry server detail
    Then a latency trend shows the three data points with increasing values
    And a warning states that progressive latency degradation was detected before failure
    And a recommendation suggests investigating server resource allocation

  Scenario: Error categorization distinguishes failure types
    Given MCP errors include a connection error, a timeout, and a registration failure
    When Rafael views the error summary
    Then each error is categorized by type: connection, timeout, and registration
    And each category shows its count and most recent occurrence

  # ===================================================================
  # Tool Call Explorer
  # ===================================================================

  Scenario: Tool call explorer shows per-server attribution with latency
    Given session 4 had 23 github calls, 8 sentry calls, and 15 postgres calls
    When Rafael opens the tool call explorer in the MCP panel
    Then each tool call shows timestamp, server name, tool name, latency, and status
    And calls are filterable by server name
    And failed calls are highlighted with error details

  Scenario: Tool call latency statistics per server
    Given github averaged 450ms latency across 23 calls
    And postgres averaged 120ms latency across 15 calls
    When Rafael views the MCP server summary
    Then github shows average latency of 450ms
    And postgres shows average latency of 120ms

  # ===================================================================
  # Empty and Edge States
  # ===================================================================

  @error
  Scenario: No MCP servers shows helpful empty state
    Given Marcus has no MCP servers configured in his Claude Code setup
    When Marcus opens the MCP health dashboard
    Then it shows "No MCP servers configured"
    And explains what MCP servers are in a brief description
    And provides a link to MCP configuration documentation

  @edge
  Scenario: First MCP event from new server appears immediately
    Given 3 MCP servers are known to Norbert
    When a tool call arrives from a newly configured 4th server "redis"
    Then "redis" appears in the MCP health table with status "connected"
    And its first tool call is recorded in the tool call explorer

  # ===================================================================
  # Historical Health Data
  # ===================================================================

  Scenario: MCP health history shows uptime percentage over time
    Given sentry had 3 errors across the week with 94.2% uptime
    And all other servers had 99% or higher uptime
    When Rafael views the weekly MCP health summary
    Then sentry shows 94.2% uptime with a warning indicator
    And other servers show their uptime percentages without warnings

  @error
  Scenario: Silent MCP disconnection detected from event pattern
    Given github MCP server stopped responding but sent no explicit disconnect event
    And the last successful github call was 15 minutes ago
    When Rafael checks the MCP health dashboard
    Then github shows a warning status indicating potential silent disconnection
    And the last successful call time is displayed
