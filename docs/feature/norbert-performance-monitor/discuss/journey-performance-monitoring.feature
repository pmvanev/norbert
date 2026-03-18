Feature: Performance Monitor Dashboard
  As a Claude Code power user monitoring multiple concurrent sessions,
  I want a multi-metric, multi-scope monitoring dashboard
  so I can understand and manage resource consumption across all active sessions.

  Background:
    Given Ravi Patel has the Norbert desktop app open
    And the norbert-usage plugin is loaded and active

  # -----------------------------------------------------------------------
  # Step 1: Open Performance Monitor -- Aggregate Overview
  # -----------------------------------------------------------------------

  Scenario: Performance Monitor displays aggregate metric grid
    Given Ravi has 3 active sessions:
      | session_id       | model    | burn_rate | cost_rate | context_pct | agents |
      | refactor-auth    | opus-4   | 312       | 0.003     | 67          | 1      |
      | migrate-db       | opus-4   | 185       | 0.002     | 45          | 1      |
      | test-coverage    | sonnet-4 | 30        | 0.0003    | 82          | 1      |
    When Ravi opens the Performance Monitor view
    Then the tokens/s total chart shows approximately 527 tok/s
    And the cost/min chart shows the aggregate cost rate
    And the active agents card shows 3 total agents
    And the per-session breakdown lists all 3 sessions with individual rates
    And the default time window is 1 minute

  Scenario: Performance Monitor shows per-session token rate breakdown
    Given Ravi has 3 active sessions with rates 312, 185, and 30 tok/s
    When Ravi views the per-session breakdown panel
    Then "refactor-auth" shows 312 tok/s with proportional bar width
    And "migrate-db" shows 185 tok/s with proportional bar width
    And "test-coverage" shows 30 tok/s with proportional bar width
    And sessions are sorted by token rate descending

  # -----------------------------------------------------------------------
  # Step 2: Scan Aggregate Metrics -- Urgency Detection
  # -----------------------------------------------------------------------

  Scenario: Context pressure chart shows per-session trend lines
    Given 3 sessions with context utilization: 67%, 45%, 82%
    When Ravi views the context window chart
    Then each session's context % is plotted as a trend line
    And lines are labeled with session name and current percentage

  Scenario: Context pressure shows amber urgency at 70% threshold
    Given session "test-coverage" has context utilization at 82%
    And the amber threshold is configured at 70%
    When Ravi views the context window chart
    Then the "test-coverage" trace uses amber coloring
    And a dashed horizontal line marks the 70% threshold
    And sessions below 70% use normal coloring

  Scenario: Context pressure shows red urgency at 90% threshold
    Given session "test-coverage" has context utilization at 92%
    And the red threshold is configured at 90%
    When Ravi views the context window chart
    Then the "test-coverage" trace uses red coloring
    And a dashed horizontal line marks the 90% threshold

  Scenario: Aggregate total equals sum of sessions
    Given 3 sessions with token rates 312, 185, and 30 tok/s
    When the aggregate tokens/s chart renders
    Then the total displayed is 527 tok/s
    And the per-session breakdown sum equals the total

  # -----------------------------------------------------------------------
  # Step 3: Drill Down -- Session Detail
  # -----------------------------------------------------------------------

  Scenario: Drill down from aggregate to session detail
    Given Ravi is viewing the aggregate Performance Monitor
    And session "refactor-auth" shows 312 tok/s in the breakdown
    When Ravi clicks on "refactor-auth" in the session list
    Then the view transitions to session detail for "refactor-auth"
    And the header shows "Performance Monitor > refactor-auth"
    And the token rate chart shows the session-specific waveform
    And a Back button is visible to return to aggregate view

  Scenario: Session detail shows context window with headroom estimate
    Given Ravi is viewing session detail for "refactor-auth"
    And the session has consumed 134,000 of 200,000 context tokens
    When the context window panel renders
    Then it shows "67%" utilization
    And it shows "134k / 200k tokens"
    And it shows an estimated time to compaction based on current burn rate

  Scenario: Agent breakdown visible in session detail
    Given Ravi is viewing session detail for "refactor-auth"
    And the session has 2 active agents: coordinator at 185 tok/s and file-reader at 127 tok/s
    When the agent breakdown panel renders
    Then "coordinator" is listed with 185 tok/s and its cost rate
    And "file-reader" is listed with 127 tok/s and its cost rate
    And the sum of agent rates approximates the session total of 312 tok/s

  Scenario: Operational metrics bar shows diagnostic indicators
    Given Ravi is viewing session detail for "refactor-auth"
    And the session is generating 3.2 tool calls per second
    And the average response latency is 1.2 seconds
    And no tool call errors have occurred
    When the operational metrics bar renders
    Then it shows "Tool calls: 3.2/s"
    And it shows "Latency: 1.2s"
    And it shows "Errors: 0"

  Scenario: Back button restores aggregate view
    Given Ravi drilled into session "refactor-auth"
    And was previously viewing the aggregate monitor with 5-minute time window
    When Ravi clicks the Back button
    Then the aggregate Performance Monitor view is restored
    And the 5-minute time window is preserved
    And all session data is current (not stale from before drill-down)

  # -----------------------------------------------------------------------
  # Step 4: Time Window Adjustment
  # -----------------------------------------------------------------------

  Scenario: Switch to 5-minute time window
    Given Ravi is viewing the Performance Monitor with 1-minute window
    When Ravi selects the "5m" time window button
    Then all charts expand to show the last 5 minutes of data
    And the stats bar shows "Window: 5m"
    And the grid line interval adjusts to the wider window

  Scenario: Switch to 15-minute time window adjusts resolution
    Given Ravi is viewing the Performance Monitor with 1-minute window
    When Ravi selects the "15m" time window button
    Then all charts show the last 15 minutes of data
    And the sample resolution decreases to approximately 1 second
    And the stats bar peak and average reflect the 15-minute window

  Scenario: Time window persists across drill-down navigation
    Given Ravi has selected the 15-minute time window on the aggregate view
    When Ravi drills into session "refactor-auth"
    Then the session detail view uses the same 15-minute window
    And when Ravi navigates back the 15-minute window is preserved

  Scenario: Session-length time window shows full session history
    Given Ravi is viewing session detail for "refactor-auth"
    And the session has been running for 42 minutes
    When Ravi selects the "Session" time window button
    Then the chart shows the full 42 minutes of session history
    And the sample resolution adjusts for the 42-minute span
    And the stats bar shows "Window: 42m"

  # -----------------------------------------------------------------------
  # Error Paths
  # -----------------------------------------------------------------------

  Scenario: Empty state when no active sessions
    Given Ravi has no active Claude Code sessions
    And the most recent session "refactor-auth" ended 2 hours ago
    When Ravi opens the Performance Monitor view
    Then an empty state message shows "No active sessions"
    And guidance text explains how to start a session with hooks enabled
    And a link to view the most recent session's historical data is provided

  Scenario: Session ends during drill-down view
    Given Ravi is viewing session detail for "refactor-auth"
    When the "refactor-auth" session ends
    Then the charts freeze at their final values
    And a subtle indicator shows "Session ended at 14:32"
    And the time window controls remain functional for historical review
    And the Back button returns to aggregate view without the ended session in active count

  Scenario: Metric data unavailable for specific chart
    Given Ravi is viewing the Performance Monitor
    And context utilization data is not available in event payloads for session "migrate-db"
    When the context window chart renders
    Then the chart slot for "migrate-db" shows "Data unavailable"
    And an explanation describes why the data is missing
    And the chart layout remains stable (no collapsed or missing slots)
    And other sessions with available data render normally

  # -----------------------------------------------------------------------
  # Oscilloscope Backward Compatibility
  # -----------------------------------------------------------------------

  Scenario: Existing oscilloscope view continues to function
    Given Ravi has configured a floating panel with the Oscilloscope view
    When the Performance Monitor is installed
    Then the floating Oscilloscope panel continues to render the dual-trace waveform
    And the Oscilloscope uses the same data pipeline as the Performance Monitor
    And no existing view registrations are removed

  # -----------------------------------------------------------------------
  # Properties (ongoing qualities)
  # -----------------------------------------------------------------------

  @property
  Scenario: Metric consistency across views
    Given any metric is displayed in both the Performance Monitor and the Gauge Cluster
    Then the values are identical at any point in time
    And urgency thresholds produce identical coloring in both views

  @property
  Scenario: Aggregate always equals sum of parts
    Given the aggregate tokens/s total is displayed
    And per-session token rates are displayed
    Then the aggregate value equals the sum of per-session values
    And no rounding discrepancy is visible to the user

  @property
  Scenario: Chart rendering performance
    Given the Performance Monitor is displaying 4 charts with live data
    Then all charts update without visible frame drops
    And the UI remains responsive to user interaction
    And the 1-minute time window updates at approximately 10Hz
    And wider time windows update at proportionally lower frequencies
