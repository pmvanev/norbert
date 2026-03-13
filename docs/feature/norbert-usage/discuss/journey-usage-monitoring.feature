Feature: Usage Monitoring Journey
  As a Claude Code power user running multi-agent sessions
  I want to monitor token consumption and cost in real time
  So that I can control spending and detect anomalous behavior without context switching

  Background:
    Given Norbert is running with the norbert-usage plugin loaded
    And the plugin has registered its views, tab, and status items via NorbertPlugin API

  # ── Step 1: Broadcast Bar Orientation ──────────────────────────────

  Scenario: Cost ticker shows live session cost in broadcast bar
    Given Ravi Patel is running a Claude Code session "refactor-auth" using Opus 4
    And the session has consumed 47,000 input tokens and 40,200 output tokens
    When Ravi opens the Norbert dashboard
    Then the broadcast bar displays session context "cc:opus-4 -- refactor-auth"
    And the cost ticker shows "$1.47"
    And the token count shows "87k tokens"
    And the live indicator dot is green

  Scenario: Cost ticker updates as new token events arrive
    Given Ravi Patel has the Norbert dashboard open showing session cost "$1.47"
    When Claude Code processes a response adding 2,100 output tokens
    And a hook event with the token count arrives at Norbert
    Then the cost ticker rolls to "$1.51" with odometer animation
    And the update occurs within 1 second of event arrival

  Scenario: Broadcast bar shows no active session state
    Given Elena Vasquez opens Norbert with no Claude Code session running
    Then the broadcast bar shows "No active session"
    And the live indicator dot is dim
    And the cost ticker shows "$0.00"

  # ── Step 2: Gauge Cluster At-a-Glance ─────────────────────────────

  Scenario: Gauge Cluster displays six instruments for active session
    Given Ravi Patel has an active session "refactor-auth" broadcast in context
    And the session has burned 327 tokens per second over the last 10 seconds
    And context window utilization is 43% (87k of 200k)
    And 2 agents are active (coordinator and specialist)
    And the session has been running for 23 minutes 47 seconds
    When Ravi views the Gauge Cluster
    Then the tachometer shows 327 tok/s
    And the fuel gauge shows 43% with no urgency coloring
    And the odometer shows $1.47 with rolling digit display
    And the RPM counter shows 2 active agents
    And the warning cluster shows all indicators green
    And the clock shows 00:23:47

  Scenario: Fuel gauge enters amber zone at 70% context utilization
    Given Ravi Patel is monitoring a session where the agent has consumed 140k of 200k context tokens
    When the context window utilization reaches 70%
    Then the fuel gauge transitions to amber coloring
    And the amber zone is visually distinct from the normal zone

  Scenario: Fuel gauge enters red zone at 90% context utilization
    Given Ravi Patel is monitoring a session where the agent has consumed 180k of 200k context tokens
    When the context window utilization reaches 90%
    Then the fuel gauge transitions to red coloring
    And the red zone signals urgency requiring attention

  Scenario: Gauge Cluster minimizes to cost pill
    Given Ravi Patel has the Gauge Cluster open as a floating panel
    When Ravi minimizes the Gauge Cluster
    Then it collapses to a pill showing "$1.47"
    And the pill updates in real time as cost increments

  # ── Step 3: Oscilloscope Waveform ─────────────────────────────────

  Scenario: Oscilloscope shows dual-trace waveform for active session
    Given Ravi Patel has an active session with varying token activity over the last 60 seconds
    When Ravi views the Token Burn Oscilloscope
    Then a token rate trace scrolls right-to-left
    And a cost rate trace scrolls on the same time axis
    And the stats bar shows peak rate, average rate, total tokens, and window duration
    And the waveform updates at approximately 10Hz

  Scenario: Oscilloscope shows flat baseline during idle period
    Given Ravi Patel has an active session where the agent is waiting for a tool result
    And no token events have arrived for 8 seconds
    When Ravi views the Oscilloscope
    Then the waveform shows a flat baseline for the last 8 seconds
    And the flat pattern is clearly distinct from active periods

  Scenario: Oscilloscope shows sharp spikes during rapid tool calls
    Given Ravi Patel has an active session where the agent is executing a bash loop
    And tool_call_start events are arriving every 200 milliseconds
    When Ravi views the Oscilloscope
    Then the waveform shows rapid repeated spikes
    And the spike pattern is clearly distinct from a sustained plateau

  Scenario: Oscilloscope shows sustained plateau during streaming response
    Given Ravi Patel has an active session where a large response is streaming
    And tokens are arriving at a steady 400 tokens per second for 15 seconds
    When Ravi views the Oscilloscope
    Then the waveform shows a sustained plateau at the 400 tok/s level
    And the plateau is clearly distinct from spike patterns

  # ── Step 4: Default Dashboard ──────────────────────────────────────

  Scenario: Default Dashboard shows six metric cards for active session
    Given Ravi Patel has an active session "refactor-auth" broadcast in context
    When Ravi views the Usage Dashboard
    Then the dashboard shows running cost "$1.47"
    And the dashboard shows token count "87,241" with input/output breakdown
    And the dashboard shows 2 active agents
    And the dashboard shows 143 tool calls
    And the dashboard shows context window at 43%
    And the dashboard shows hook health as OK

  Scenario: Default Dashboard shows 7-day burn chart
    Given Elena Vasquez has used Claude Code for the past 7 days
    And daily costs were $4.20, $6.10, $3.80, $8.50, $5.20, $2.90, $3.10
    When Elena views the Usage Dashboard
    Then the 7-day burn chart shows a bar for each day
    And the bars are proportional to the daily cost values
    And the current day's bar updates in real time if a session is active

  Scenario: Dashboard shows onboarding state for new user
    Given Marcus Chen has just installed Norbert and has no session history
    When Marcus opens the Usage Dashboard
    Then the metric cards show zeroed or placeholder values
    And the dashboard displays an onboarding prompt explaining how to start

  # ── Step 5: Floating Panel Ambient Monitoring ──────────────────────

  Scenario: Gauge Cluster floats alongside primary work
    Given Ravi Patel has positioned the Gauge Cluster as a floating panel in the bottom-right corner
    And he switches focus to his terminal to continue working
    When a new agent spawns in the active session
    Then the Gauge Cluster RPM counter increments to 3
    And the change is visible in peripheral vision without switching windows

  # ── Error Paths ────────────────────────────────────────────────────

  Scenario: Hook events stop arriving mid-session
    Given Ravi Patel has an active session with events arriving normally
    When no hook events arrive for 30 seconds
    Then the Gauge Cluster warning cluster turns amber for hook health
    And the Oscilloscope waveform shows a flat line
    And the status bar indicates "Hook events: stale"

  Scenario: Hook events stop arriving for 60 seconds
    Given Ravi Patel has an active session where events stopped 30 seconds ago
    And the warning cluster is already amber
    When an additional 30 seconds pass with no events (60 seconds total)
    Then the warning cluster turns red for hook health

  Scenario: Token data missing from hook event
    Given Ravi Patel has an active session
    When a tool_call_start event arrives without token count fields
    Then the tool call count increments
    But the token count and cost metrics do not change
    And no false zero values are displayed

  Scenario: User selects ended session in broadcast bar
    Given Elena Vasquez has a completed session "migrate-db" from 2 hours ago
    When Elena selects "migrate-db" in the broadcast bar session picker
    Then the broadcast bar live indicator shows dim (not live)
    And the Oscilloscope shows the historical waveform for that session
    And the Gauge Cluster shows final session values

  # ── Plugin Registration ────────────────────────────────────────────

  Scenario: norbert-usage registers its views and tab during onLoad
    Given the norbert-usage plugin manifest declares id "norbert-usage"
    When the plugin system calls onLoad with the NorbertAPI
    Then the plugin registers a "gauge-cluster" view via api.ui.registerView
    And the plugin registers an "oscilloscope" view via api.ui.registerView
    And the plugin registers a "usage-dashboard" view as primaryView via api.ui.registerView
    And the plugin registers a sidebar tab via api.ui.registerTab
    And the plugin registers a cost ticker status item via api.ui.registerStatusItem

  Scenario: Gauge Cluster view registration supports floating panel
    Given norbert-usage calls api.ui.registerView for the Gauge Cluster
    Then the registration includes floatMetric "session_cost"
    And the registration includes minWidth and minHeight suitable for 3x2 gauge grid
