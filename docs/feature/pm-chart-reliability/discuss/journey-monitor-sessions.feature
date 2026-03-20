Feature: Performance Monitor Chart Reliability
  As a developer running multiple Claude Code sessions
  I want the Performance Monitor charts to display live data, respond to hover,
  and support time window switching
  So that I can monitor resource consumption like Windows Task Manager

  Background:
    Given Raj Patel has 3 active Claude Code sessions ("refactor-abc1", "tests-def2", "chat-ghi3")
    And the sessions have been generating token events for at least 2 minutes
    And the Performance Monitor view is open with "Tokens/s" category selected

  # -------------------------------------------------------------------------
  # Step 1: Charts display live data
  # -------------------------------------------------------------------------

  Scenario: Aggregate chart shows visible data when sessions are active
    Given the 3 sessions have produced a combined rate of approximately 840 tokens per second
    When the Performance Monitor renders
    Then the aggregate chart displays a non-empty line graph
    And the line has at least 10 data points visible
    And the chart area is not blank or fully transparent

  Scenario: Chart line advances as new data arrives
    Given the aggregate chart is displaying token rate data
    When 5 seconds elapse and new session events arrive
    Then the chart line extends rightward with new data points
    And the rightmost point represents the most recent sample

  Scenario: Per-session charts show individual session data
    Given the "refactor-abc1" session is generating 420 tokens per second
    And the "tests-def2" session is generating 310 tokens per second
    And the "chat-ghi3" session is generating 110 tokens per second
    When the per-session grid renders below the aggregate chart
    Then each session has its own mini chart with a visible data line
    And the "refactor-abc1" mini chart shows higher values than "chat-ghi3"

  Scenario: Empty state when no sessions are active
    Given Raj has no active Claude Code sessions
    When the Performance Monitor view renders
    Then the chart area shows a clear empty-state message
    And the message indicates that sessions must be active to see data

  Scenario: Chart continues rendering after session ends
    Given the "chat-ghi3" session ends while charts are visible
    When the remaining 2 sessions continue generating events
    Then the aggregate chart continues updating with data from 2 sessions
    And the ended session disappears from the per-session grid

  # -------------------------------------------------------------------------
  # Step 2: Tooltip and crosshair positioning
  # -------------------------------------------------------------------------

  Scenario: Tooltip appears near cursor on hover
    Given the aggregate chart displays token rate data
    When Raj moves his mouse to a point on the chart showing 527 tokens per second from 12 seconds ago
    Then a tooltip appears within 16 pixels of the cursor position
    And the tooltip shows "527 tok/s"
    And the tooltip shows "12s ago"

  Scenario: Crosshair aligns with cursor at 100% DPI scaling
    Given the Windows display scaling is set to 100%
    And the aggregate chart displays data
    When Raj moves his mouse horizontally across the chart
    Then the vertical crosshair line follows the mouse cursor without visible offset

  Scenario: Crosshair aligns with cursor at 150% DPI scaling
    Given the Windows display scaling is set to 150%
    And the aggregate chart displays data
    When Raj moves his mouse horizontally across the chart
    Then the vertical crosshair line follows the mouse cursor without visible offset
    And the tooltip position remains within 16 pixels of the cursor

  Scenario: Tooltip disappears when mouse leaves chart
    Given the tooltip is visible over the aggregate chart
    When Raj moves his mouse outside the chart area
    Then the tooltip disappears
    And the crosshair line disappears

  # -------------------------------------------------------------------------
  # Step 3: Time window switching
  # -------------------------------------------------------------------------

  Scenario: Switching to 5-minute window shows wider data range
    Given Raj is viewing the 1-minute token rate chart
    And the session has been active for 6 minutes
    When Raj clicks the "5m" time window button
    Then the chart displays approximately 5 minutes of historical data
    And the duration label below the chart reads "5 minutes"
    And the X-axis range spans roughly 300 seconds

  Scenario: Switching to 15-minute window with sufficient history
    Given Raj is viewing the 1-minute token rate chart
    And the session has been active for 20 minutes
    When Raj clicks the "15m" time window button
    Then the chart displays approximately 15 minutes of historical data
    And the duration label reads "15 minutes"

  Scenario: Switching to Session window shows full session duration
    Given Raj is viewing the 1-minute token rate chart
    And the session has been active for 45 minutes
    When Raj clicks the "Session" time window button
    Then the chart displays the full 45-minute session history
    And the duration label reads "Full session"

  Scenario: Switching back to 1-minute preserves resolution
    Given Raj has switched to the 5-minute time window
    When Raj clicks the "1m" time window button
    Then the chart returns to the 1-minute view
    And the data resolution is higher (more points per second) than the 5m view

  # -------------------------------------------------------------------------
  # Step 4: Category switching
  # -------------------------------------------------------------------------

  Scenario: Switching to Cost category updates chart presentation
    Given Raj is viewing the Tokens/s aggregate chart
    When Raj clicks "Cost" in the sidebar
    Then the detail pane header displays "Cost"
    And the chart line uses the amber color (#f0920a or themed equivalent)
    And the stats grid shows cost-specific metrics including "Session Total" and "Avg Cost/Token"
    And tooltip values format as dollars per minute (e.g., "$0.12/min")

  Scenario: Switching to Context category shows per-session only
    Given Raj is viewing the Tokens/s aggregate chart
    When Raj clicks "Context" in the sidebar
    Then the aggregate chart is hidden (context is not aggregatable)
    And per-session charts show context window percentage for each session
    And the Y-axis range spans 0% to 100%

  # -------------------------------------------------------------------------
  # Property-based scenarios
  # -------------------------------------------------------------------------

  @property
  Scenario: Chart updates at consistent 1Hz minimum refresh rate
    Given the Performance Monitor is displaying live data
    Then the chart redraws at least once per second
    And the visual position of the rightmost data point advances over time

  @property
  Scenario: Tooltip position accuracy across DPI settings
    Given any Windows DPI scaling between 100% and 200%
    Then the tooltip appears within 16 pixels of the actual cursor position
    And the crosshair vertical line intersects the cursor X coordinate within 2 pixels
