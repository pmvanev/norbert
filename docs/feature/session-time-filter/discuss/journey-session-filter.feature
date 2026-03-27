Feature: Session time filter
  As a Norbert user
  I want to filter the sessions list by time window
  So I can focus on currently relevant sessions

  Background:
    Given the Sessions view is open

  # --- Job 1: Focus on what's happening now ---

  Scenario: Filter to active sessions only
    Given there are 3 active sessions and 10 completed sessions
    When I select the "Active Now" filter
    Then the session list shows 3 sessions
    And all displayed sessions have a pulsing active indicator
    And the header shows "3 sessions"

  Scenario: No active sessions shows empty state
    Given there are 0 active sessions and 5 completed sessions
    When I select the "Active Now" filter
    Then the session list shows an empty state message "No sessions in this time window"
    And the header shows "0 sessions"

  # --- Job 2: Review recent activity ---

  Scenario: Filter to last 15 minutes
    Given there are sessions with last activity at 5 min, 10 min, 30 min, and 2 hours ago
    When I select the "Last 15 min" filter
    Then the session list shows the sessions active at 5 min and 10 min ago
    And sessions active at 30 min and 2 hours ago are not displayed

  Scenario: Filter to last hour
    Given there are sessions with last activity at 5 min, 30 min, 2 hours, and 25 hours ago
    When I select the "Last hour" filter
    Then the session list shows the sessions active at 5 min and 30 min ago
    And sessions active at 2 hours and 25 hours ago are not displayed

  Scenario: Filter to last 24 hours
    Given there are sessions with last activity at 1 hour, 12 hours, 23 hours, and 48 hours ago
    When I select the "Last 24 hrs" filter
    Then the session list shows the sessions active at 1 hour, 12 hours, and 23 hours ago
    And the session active at 48 hours ago is not displayed

  Scenario: Session that started before window but was active within it is included
    Given a session started 2 hours ago with last_event_at 10 minutes ago
    When I select the "Last 15 min" filter
    Then the session is included in the filtered list

  # --- Job 3: Session count reflects filter ---

  Scenario: Header count reflects filtered results
    Given there are 20 total sessions and 4 were active in the last hour
    When I select the "Last hour" filter
    Then the header shows "4 sessions"

  # --- Default and persistence ---

  Scenario: Default filter shows all sessions
    Given there are 15 sessions
    When the Sessions view loads for the first time
    Then the filter is set to "All"
    And all 15 sessions are displayed

  Scenario: Filter persists when returning from session detail
    Given I have selected the "Last hour" filter
    When I click a session to view its detail
    And I navigate back to the Sessions list
    Then the filter is still set to "Last hour"
