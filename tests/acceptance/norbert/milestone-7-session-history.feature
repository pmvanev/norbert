@skip @US-008 @JS-6
Feature: Session History -- Search, Trends, Baselines, and CSV Export

  As a team lead responsible for AI tooling budget,
  I want to search session history, see weekly trends, and export data for stakeholders,
  so I can establish baselines, identify anomalies, and make data-driven budget decisions.

  Background:
    Given Norbert is running with historical session data

  # ===================================================================
  # Walking Skeleton: Weekly review delivers trend visibility
  # ===================================================================

  @walking_skeleton
  Scenario: Weekly review shows cost trends and established baselines
    Given Rafael has 42 sessions over 7 days totaling $28.40
    And the daily average cost is $4.06
    When Rafael opens the weekly review page
    Then he sees a daily cost trend chart for the past 7 days
    And he sees the weekly total of $28.40 and daily average of $4.06
    And he sees baselines showing average session cost of $0.68 and P95 of $2.10

  # ===================================================================
  # Search and Filtering
  # ===================================================================

  Scenario: Session list filterable by cost range
    Given 42 sessions exist with costs ranging from $0.15 to $2.10
    When Marcus filters sessions to cost greater than $1.50
    Then 7 sessions appear in the filtered results
    And all displayed sessions have costs above $1.50

  Scenario: Session list filterable by date range
    Given sessions span the past 30 days
    When Marcus filters to the past 7 days only
    Then only sessions from the last 7 days are displayed
    And older sessions are excluded from the results

  Scenario: Session list sortable by multiple columns
    Given 20 sessions with varying costs, durations, and agent counts
    When Marcus sorts by cost descending
    Then the most expensive session appears first
    And sorting by duration or agent count reorders the list accordingly

  Scenario: Combined filters narrow results accurately
    Given 42 sessions exist across 30 days
    When Marcus filters to cost greater than $1.00 within the past 7 days
    Then only sessions matching both criteria are displayed
    And the result count is correct

  # ===================================================================
  # Trend Charts
  # ===================================================================

  Scenario: Daily cost trend shows spike and recovery pattern
    Given Tuesday had $6.20 in costs and other days averaged $3.70
    When Rafael views the daily cost trend chart
    Then Tuesday shows a visible spike above the other days
    And the overall trend shows a decline after the optimization on Wednesday

  Scenario: Session count trend alongside cost trend
    Given some days had more sessions than others
    When Rafael views the weekly trend
    Then both cost and session count trends are visible
    And days with many cheap sessions are distinguishable from days with few expensive ones

  # ===================================================================
  # Baselines
  # ===================================================================

  Scenario: Baselines computed from sufficient data
    Given 42 sessions over 7 days with various costs
    When baselines are computed
    Then the average session cost reflects the mean across all sessions
    And the P95 cost reflects the 95th percentile
    And the average duration reflects the mean session length

  @error
  Scenario: Insufficient data produces preliminary baselines with warning
    Given Rafael has only 2 days of Norbert data with 4 sessions
    When Rafael opens the weekly review page
    Then baselines are displayed but marked as "preliminary"
    And a note states that 5 or more days are recommended for reliable baselines

  # ===================================================================
  # CSV Export
  # ===================================================================

  Scenario: CSV export downloads accurate usage data
    Given Marcus needs to share usage data with the finance team
    When Marcus exports the monthly data as CSV
    Then a CSV file downloads with columns for date, session count, total tokens, and estimated cost
    And the CSV data matches what is displayed on the dashboard

  Scenario: CSV export respects active filters
    Given Marcus has filtered to the past 7 days
    When Marcus exports the filtered data as CSV
    Then the CSV contains only the 7-day filtered data
    And the CSV header row identifies all columns

  # ===================================================================
  # Error and Edge Cases
  # ===================================================================

  @error
  Scenario: Empty history shows onboarding guidance
    Given no sessions have been captured yet
    When Marcus opens the session history page
    Then a message explains that no historical data is available
    And suggests running Claude Code sessions to build history

  @edge
  Scenario: History with 30 days of data loads efficiently
    Given 30 days of session data with approximately 300 sessions
    When the history page loads
    Then the page renders completely within acceptable performance limits
    And filters and sorting respond without noticeable delay

  @property
  Scenario: Weekly total always equals sum of daily totals
    Given any week of session data
    When the weekly total cost is computed
    Then it equals the sum of the 7 daily cost totals exactly
