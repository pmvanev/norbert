Feature: Session Metrics Table — Heat-Colored Cells
  As a Norbert user
  I want metric cells to shade from neutral to amber to red as values increase
  So I can visually spot sessions consuming the most resources at a glance

  Background:
    Given multiple sessions with varying metrics are visible in the table

  @skip
  Scenario: Cost cell shading reflects spending level
    Given session "norbert" has cost $4.50
    And session "api-server" has cost $0.08
    And session "docs-site" has cost $0.80
    When the user views the metrics table
    Then the "norbert" cost cell shows a red heat shade
    And the "api-server" cost cell shows neutral (no shading)
    And the "docs-site" cost cell shows an amber heat shade

  @skip
  Scenario: Context utilization cell shading warns of compaction risk
    Given session "norbert" is at 92% context utilization
    And session "api-server" is at 30% context utilization
    When the user views the metrics table
    Then the "norbert" context cell shows a red heat shade
    And the "api-server" context cell shows neutral

  @skip
  Scenario: Burn rate cell shading highlights fast token consumption
    Given session "norbert" has burn rate 450 tok/s
    And session "api-server" has burn rate 25 tok/s
    When the user views the metrics table
    Then the "norbert" burn rate cell shows a red heat shade
    And the "api-server" burn rate cell shows neutral

  @skip
  Scenario: Token count cell shading reflects volume
    Given session "norbert" has used 500K tokens
    And session "api-server" has used 5K tokens
    When the user views the metrics table
    Then the "norbert" tokens cell shows a red heat shade
    And the "api-server" tokens cell shows neutral

  @skip
  Scenario: API health cell shading highlights error-prone sessions
    Given session "norbert" has 99.8% API success rate
    And session "flaky-build" has 85% API success rate
    When the user views the metrics table
    Then the "flaky-build" API health cell shows a red heat shade
    And the "norbert" API health cell shows neutral

  @skip @error
  Scenario: Heat coloring adjusts when metrics update in real time
    Given session "norbert" cost cell is currently neutral at $0.10
    When the session cost increases to $3.00
    Then the cost cell transitions to an amber or red heat shade

  @skip @error
  Scenario: Heat coloring handles zero and missing values without error
    Given session "idle" has zero cost, zero tokens, and zero burn rate
    When the user views the metrics table
    Then all metric cells for "idle" show neutral shading
    And no cells display errors or broken styling

  @skip @property
  Scenario: Heat shade intensity never decreases as metric value increases
    Given any two sessions where one has a strictly higher metric value
    When both cells are rendered
    Then the higher-value cell has equal or greater heat intensity
