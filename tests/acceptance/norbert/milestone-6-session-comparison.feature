@skip @US-007 @JS-1
Feature: Session Comparison -- Before and After Optimization

  As a Claude Code power user who restructured a prompt to reduce costs,
  I want to compare the new session to the old one with concrete metrics,
  so I can verify my optimization worked and quantify the improvement.

  Background:
    Given Norbert is running with multiple sessions captured

  # ===================================================================
  # Walking Skeleton: Comparison shows improvement metrics
  # ===================================================================

  @walking_skeleton
  Scenario: Cost comparison validates workflow optimization
    Given session 4 had 67,234 tokens, $2.02 cost, 14 file-migrator reads, and 1 MCP error
    And session 7 had 31,200 tokens, $0.94 cost, 3 file-migrator reads, and 0 MCP errors
    When Rafael compares session 7 against session 4
    Then he sees total tokens decreased by 54%
    And he sees total cost decreased by 53%
    And he sees file-migrator reads decreased from 14 to 3
    And he sees projected monthly savings of approximately $97

  # ===================================================================
  # Per-Agent Comparison
  # ===================================================================

  Scenario: Shared agents show side-by-side metric comparison
    Given both sessions had agents orchestrator, analyzer, and migrator
    And migrator cost decreased from $1.08 to $0.42
    When Rafael views the per-agent comparison
    Then each shared agent shows previous cost, current cost, and change percentage
    And migrator shows a 61% cost decrease

  Scenario: New and removed agents labeled in comparison
    Given session 4 had agents orchestrator, analyzer, and migrator
    And session 7 had agents orchestrator, analyzer, migrator, and validator
    When Priya views the comparison
    Then shared agents show side-by-side metrics
    And validator is marked as "new in current session"

  Scenario: Removed agent from previous session identified
    Given session 4 had agents orchestrator, analyzer, migrator, and legacy-checker
    And session 7 had agents orchestrator, analyzer, and migrator
    When Rafael views the comparison
    Then legacy-checker is marked as "removed from current session"
    And its previous cost is shown for reference

  # ===================================================================
  # Projected Savings
  # ===================================================================

  Scenario: Monthly savings projection based on session frequency
    Given the cost decreased by $1.08 per session
    And Rafael runs approximately 3 similar sessions per day
    When the comparison calculates projected savings
    Then the projected monthly savings are approximately $97

  # ===================================================================
  # Error and Edge Cases
  # ===================================================================

  @error
  Scenario: Single session produces helpful guidance message
    Given only 1 session exists in the database
    When Rafael requests a session comparison
    Then the output states that only 1 session is available
    And suggests running at least 2 sessions to enable comparison

  @error
  Scenario: Comparison between sessions with different models
    Given session 4 used claude-opus and session 7 used claude-sonnet
    When Rafael compares the two sessions
    Then the comparison shows the model difference prominently
    And a note explains that cost differences may reflect model pricing rather than optimization

  @edge
  Scenario: Comparison with identical sessions shows no change
    Given two sessions with identical token counts and costs
    When Rafael compares them
    Then all change percentages show 0%
    And no projected savings are displayed

  # ===================================================================
  # CLI and Dashboard Parity
  # ===================================================================

  Scenario: CLI comparison matches dashboard comparison view
    Given sessions 4 and 7 exist with known metrics
    When Rafael compares via command line
    And Rafael compares via the dashboard
    Then both show the same change percentages
    And both show the same projected monthly savings
