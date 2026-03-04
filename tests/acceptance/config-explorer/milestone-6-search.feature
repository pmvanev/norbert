@skip @US-CE-06
Feature: Configuration Search
  As a developer who knows what to find but not where it is defined,
  I want to search across all configuration files in all scopes,
  so I can locate configuration elements without running grep across directories.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton: Search finds hooks across scopes
  # ===================================================================

  @walking_skeleton
  Scenario: Developer searches for hooks across all scopes
    Given hooks mentioning "PreToolUse" are defined in 3 files across 3 scopes
    When the developer searches for "PreToolUse"
    Then 3 results are returned
    And each result includes the file path and scope
    And each result includes the matching line content

  # ===================================================================
  # Happy Path: Search by setting key
  # ===================================================================

  Scenario: Search for a setting key finds all defining files
    Given user settings define "permissions" with allowed tools
    And project settings define "permissions" with different allowed tools
    When the developer searches for "permissions"
    Then results include both the user and project settings files
    And each result shows the matching line within the file

  # ===================================================================
  # Error Path: No results with guidance message
  # ===================================================================

  @error
  Scenario: Search for absent term shows no results with guidance
    Given no configuration file contains the term "kubernetes"
    When the developer searches for "kubernetes"
    Then zero results are returned
    And a guidance message suggests searching for setting names or rule keywords

  # ===================================================================
  # Edge Case: Short search term
  # ===================================================================

  @edge
  Scenario: Search requires a minimum query length
    When the developer searches for "a"
    Then a validation message indicates the minimum search length

  # ===================================================================
  # Boundary: Search across different file formats
  # ===================================================================

  Scenario: Search finds matches in both settings files and rule files
    Given project settings mention "Bash" in the hooks section
    And a project rule mentions "Bash" in its content body
    When the developer searches for "Bash"
    Then results include the settings file and the rule file
    And each result identifies its subsystem classification

  # ===================================================================
  # Error Path: Special characters in search query
  # ===================================================================

  @error
  Scenario: Search handles special characters without errors
    When the developer searches for "**/*.ts"
    Then results include rule files containing that glob pattern
    And no error occurs from the special characters in the query
