Feature: Session Metrics Table — Sorting
  As a Norbert user
  I want to sort the metrics table by any column
  So I can find the most expensive, most active, or longest-running sessions

  Background:
    Given multiple sessions with varying metrics are visible in the table

  @skip
  Scenario: Default sort shows active sessions first, then most recent
    Given two active sessions started 5 and 15 minutes ago
    And three completed sessions from 1 hour, 3 hours, and 1 day ago
    When the user opens the Sessions tab
    Then active sessions appear at the top
    And within each group, sessions are ordered most recent first

  @skip
  Scenario: Sort sessions by cost ascending
    Given sessions with costs $0.08, $1.24, and $0.52
    When the user clicks the Cost column header
    Then sessions are ordered $0.08, $0.52, $1.24 (lowest cost first)
    And the Cost column shows an ascending sort arrow

  @skip
  Scenario: Sort sessions by cost descending on second click
    Given sessions are currently sorted by cost ascending
    When the user clicks the Cost column header again
    Then sessions are ordered $1.24, $0.52, $0.08 (highest cost first)
    And the Cost column shows a descending sort arrow

  @skip
  Scenario: Sort sessions by token count
    Given sessions with token counts 9.3K, 61.0K, and 142.5K
    When the user clicks the Tokens column header
    Then sessions are ordered by token count ascending
    And clicking again reverses to descending order

  @skip
  Scenario: Sort sessions by burn rate to find fastest consumers
    Given session "norbert" has burn rate 150 tok/s
    And session "api-server" has burn rate 12 tok/s
    And session "docs-site" has burn rate 0 tok/s
    When the user sorts by Burn Rate descending
    Then "norbert" appears first at 150 tok/s
    And "docs-site" appears last at 0 tok/s

  @skip
  Scenario: Sort sessions by context utilization
    Given session "norbert" is at 82% context
    And session "api-server" is at 15% context
    When the user sorts by Context descending
    Then "norbert" appears first showing 82%

  @skip
  Scenario: Sort sessions by duration
    Given sessions running for 2 minutes, 45 minutes, and 3 hours
    When the user sorts by Duration descending
    Then the 3-hour session appears first

  @skip
  Scenario: Sort persists when new session data arrives
    Given sessions are sorted by cost descending
    When a session's cost updates from $0.52 to $0.60
    Then the sort order adjusts to reflect the new cost
    And the table does not jump to default sort

  @skip @error
  Scenario: Sort handles sessions with missing metrics gracefully
    Given session "legacy" has no cost or token data yet
    And session "norbert" has cost $1.24
    When the user sorts by Cost ascending
    Then "legacy" appears with a dash placeholder in the Cost column
    And "legacy" sorts to the beginning (missing treated as zero)
