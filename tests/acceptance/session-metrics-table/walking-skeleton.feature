Feature: Session Metrics Table — Walking Skeletons
  As a Norbert user
  I want to see my sessions in a sortable metrics table
  So I can quickly compare session activity and resource usage at a glance

  Background:
    Given sessions are being tracked by the Norbert plugin

  @walking_skeleton
  Scenario: User views sessions as a metrics table with name and status
    Given three sessions are running: "norbert", "api-server", and "docs-site"
    And "norbert" and "api-server" are active
    And "docs-site" completed 10 minutes ago
    When the user opens the Sessions tab
    Then sessions appear as table rows with columns for Status and Name
    And "norbert" and "api-server" show a pulsing green status indicator
    And "docs-site" shows a dim completed status indicator
    And each row displays the project folder name derived from the working directory

  @walking_skeleton
  Scenario: User compares session costs and token usage across sessions
    Given session "norbert" has spent $1.24 and used 142.5K tokens
    And session "api-server" has spent $0.08 and used 9.3K tokens
    And session "docs-site" has spent $0.52 and used 61.0K tokens
    When the user views the metrics table
    Then the Cost column shows "$1.24", "$0.08", and "$0.52" for each session
    And the Tokens column shows "142.5K", "9.3K", and "61.0K" for each session
    And the user can compare resource usage without opening each session individually

  @walking_skeleton
  Scenario: User selects a session row to view detailed metrics
    Given session "norbert" appears in the metrics table
    When the user clicks the "norbert" row
    Then the session detail panel opens for "norbert"
    And the selected row is visually highlighted
