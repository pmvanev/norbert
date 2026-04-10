Feature: Session Metrics Table — Keyboard Navigation
  As a Norbert user
  I want to navigate the metrics table with keyboard
  So I can efficiently browse sessions without using a mouse

  Background:
    Given multiple sessions are visible in the metrics table

  @skip
  Scenario: Arrow down moves selection to next row
    Given the first session row is focused
    When the user presses the down arrow key
    Then the second session row becomes focused
    And the focus indicator moves to the second row

  @skip
  Scenario: Arrow up moves selection to previous row
    Given the third session row is focused
    When the user presses the up arrow key
    Then the second session row becomes focused

  @skip
  Scenario: Enter key opens session detail panel
    Given the "norbert" session row is focused
    When the user presses Enter
    Then the session detail panel opens for "norbert"

  @skip @error
  Scenario: Arrow down at last row stays on last row
    Given the last session row is focused
    When the user presses the down arrow key
    Then focus remains on the last row
    And no error occurs

  @skip @error
  Scenario: Arrow up at first row stays on first row
    Given the first session row is focused
    When the user presses the up arrow key
    Then focus remains on the first row

  @skip
  Scenario: Tab key moves focus into the table from surrounding elements
    Given focus is on the time filter dropdown above the table
    When the user presses Tab
    Then focus moves to the first row of the metrics table

  @skip @error
  Scenario: Keyboard navigation works with zero sessions
    Given no sessions are visible in the table
    When the user presses the down arrow key
    Then nothing happens and no error occurs
