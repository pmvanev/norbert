Feature: Session Metrics Table — Status Bar
  As a Norbert user
  I want to see aggregate totals across all visible sessions
  So I can understand my overall resource usage at a glance

  Background:
    Given sessions are visible in the metrics table

  @skip
  Scenario: Status bar shows totals across visible sessions
    Given 5 sessions are visible with total cost $3.47 and 285K total tokens
    When the user views the metrics table
    Then the status bar shows "5 sessions" total count
    And the status bar shows "$3.47" total cost
    And the status bar shows "285K" total tokens

  @skip
  Scenario: Status bar updates when time filter changes
    Given 10 sessions are visible with "All sessions" filter showing $12.50 total cost
    When the user switches the filter to "Last hour"
    And 3 sessions match the filter with $2.10 total cost
    Then the status bar shows "3 sessions"
    And the status bar shows "$2.10" total cost

  @skip
  Scenario: Status bar updates in real time as session costs change
    Given the status bar shows "$3.47" total cost
    When a session's cost increases by $0.15
    Then the status bar shows "$3.62" total cost

  @skip @error
  Scenario: Status bar shows zeros when no sessions are visible
    Given the time filter is set to "Active Now" and no sessions are active
    When the user views the metrics table
    Then the status bar shows "0 sessions"
    And the status bar shows "$0.00" total cost
    And the status bar shows "0" total tokens

  @skip @property
  Scenario: Status bar total cost equals sum of individual session costs
    Given any set of visible sessions with known costs
    When the status bar is rendered
    Then the displayed total cost equals the sum of all visible session costs
