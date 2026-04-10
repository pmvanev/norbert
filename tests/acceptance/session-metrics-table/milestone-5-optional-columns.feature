Feature: Session Metrics Table — Optional Columns
  As a Norbert user
  I want to show or hide additional columns via right-click menu
  So I can customize the table to show the metrics I care about

  Background:
    Given the metrics table is showing default columns

  @skip
  Scenario: Right-click column header shows available optional columns
    When the user right-clicks on any column header
    Then a context menu appears listing optional columns:
      | Column              |
      | Claude Code Version |
      | Platform            |
      | Input Tokens        |
      | Output Tokens       |
      | Cache Hit %         |
      | Active Agents       |
      | Events              |

  @skip
  Scenario: User enables Claude Code Version column
    Given the Claude Code Version column is not visible
    When the user enables "Claude Code Version" from the column menu
    Then a "Version" column appears showing values like "Claude Code 2.1.81"

  @skip
  Scenario: User enables Platform column
    Given the Platform column is not visible
    When the user enables "Platform" from the column menu
    Then a "Platform" column appears showing values like "Windows amd64"

  @skip
  Scenario: User enables Input and Output token split columns
    When the user enables "Input Tokens" and "Output Tokens" from the column menu
    Then separate columns appear for input and output token counts
    And token counts are formatted with K suffix

  @skip
  Scenario: User enables Cache Hit percentage column
    Given session "norbert" has 40K cache read tokens out of 100K total tokens
    When the user enables "Cache Hit %" from the column menu
    Then the Cache Hit column shows "40%" for "norbert"

  @skip
  Scenario: User hides a previously enabled optional column
    Given the "Platform" column is currently visible
    When the user disables "Platform" from the column menu
    Then the Platform column is removed from the table

  @skip @error
  Scenario: Optional column shows placeholder for sessions without that data
    Given session "legacy" has no service_version metadata
    When the user enables "Claude Code Version" from the column menu
    Then the Version column shows a dash for "legacy"
    And other sessions with version data display normally

  @skip
  Scenario: Active Agents column shows agent count per session
    Given session "norbert" has 3 active agents
    And session "api-server" has 0 active agents
    When the user enables "Active Agents" from the column menu
    Then "norbert" shows "3" and "api-server" shows "0"
