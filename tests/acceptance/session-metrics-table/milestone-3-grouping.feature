Feature: Session Metrics Table — Row Grouping
  As a Norbert user
  I want sessions grouped under "Active Sessions" and "Recent Sessions" headers
  So I can quickly distinguish live sessions from completed ones

  Background:
    Given sessions are visible in the metrics table

  @skip
  Scenario: Sessions grouped under Active and Recent headers
    Given two sessions are currently active
    And three sessions completed within the last hour
    When the user views the metrics table
    Then an "Active Sessions" group header appears with 2 sessions beneath
    And a "Recent Sessions" group header appears with 3 sessions beneath

  @skip
  Scenario: Active group header shows count of active sessions
    Given four sessions are currently active
    When the user views the metrics table
    Then the "Active Sessions" header shows "(4)"

  @skip
  Scenario: User collapses the Recent Sessions group
    Given the Recent Sessions group is expanded showing 5 sessions
    When the user clicks the "Recent Sessions" group header
    Then the 5 recent session rows are hidden
    And the group header shows a collapsed indicator

  @skip
  Scenario: User expands a collapsed group
    Given the Recent Sessions group is collapsed
    When the user clicks the "Recent Sessions" group header
    Then the recent session rows become visible again
    And the group header shows an expanded indicator

  @skip
  Scenario: Stale session moves from Active to Recent group
    Given session "norbert" was active 6 minutes ago (beyond staleness threshold)
    When the table refreshes
    Then "norbert" appears under "Recent Sessions" instead of "Active Sessions"
    And "norbert" shows a dim completed status indicator

  @skip @error
  Scenario: No active sessions shows empty Active group message
    Given all sessions have completed
    When the user views the metrics table
    Then the "Active Sessions" group shows "No active sessions"
    And the "Recent Sessions" group shows all sessions

  @skip @error
  Scenario: No recent sessions shows only Active group
    Given two sessions are active and the time filter is set to "Active Now"
    When the user views the metrics table
    Then only the "Active Sessions" group appears with 2 sessions
    And no "Recent Sessions" group is shown
