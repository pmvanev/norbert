@skip @US-CE-05
Feature: Configuration Mind Map Overview
  As a developer wanting a quick structural overview,
  I want to see all subsystem branches with element counts,
  so I can understand the configuration taxonomy at a glance.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton: 8 branches with element counts
  # ===================================================================

  @walking_skeleton
  Scenario: Developer sees 8 subsystem branches with element counts
    Given the project has configuration across multiple subsystems
    And 14 configuration files span memory, settings, rules, skills, and agents
    When the developer requests the configuration model
    Then the model includes 8 subsystem categories
    And each category shows the count of elements it contains
    And the subsystem counts sum to the total file count

  # ===================================================================
  # Happy Path: Scope breakdown per branch
  # ===================================================================

  Scenario: Each subsystem branch shows scope distribution
    Given rules exist at both user and project scopes
    And the user scope has 2 rule files
    And the project scope has 4 rule files
    When the developer requests the configuration model
    Then the rules subsystem shows 6 total elements
    And the scope breakdown shows 2 from user and 4 from project

  # ===================================================================
  # Edge Case: Empty subsystems shown with zero count
  # ===================================================================

  @edge
  Scenario: Minimal configuration shows active and empty subsystems
    Given only a CLAUDE.md and settings.json exist
    When the developer requests the configuration model
    Then memory shows a count of 1
    And settings shows a count of 1
    And rules, skills, agents, hooks, plugins, and MCP show counts of 0

  # ===================================================================
  # Boundary: Counts match Atlas tree
  # ===================================================================

  @property
  Scenario: Subsystem counts in the model match the file tree totals
    Given any valid configuration with files across multiple subsystems
    When the developer requests both the configuration model and the configuration tree
    Then the count of files per subsystem in the model matches the count in the tree
