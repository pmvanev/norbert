@US-CE-07
Feature: Walking Skeleton -- Settings Parsed and Served via Config Explorer
  As a developer exploring my project's configuration,
  I want to see my settings files from both user and project scopes
  rendered with scope annotations,
  so I can confirm Config Explorer works before investing in advanced views.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton 1: Two-scope settings parsed and served
  # Proves: ConfigFileReaderPort -> parser -> API -> response with scopes
  # ===================================================================

  @walking_skeleton
  Scenario: Developer sees settings from both user and project scopes
    Given user settings contain model preference "sonnet"
    And project settings contain permission "Read"
    When the developer requests the configuration tree
    Then the response includes user-scope settings with model "sonnet"
    And the response includes project-scope settings with permission "Read"
    And each settings file is annotated with its scope

  # ===================================================================
  # Walking Skeleton 2: Missing file handled gracefully
  # ===================================================================

  @walking_skeleton
  Scenario: Missing user settings file shown as placeholder
    Given only project settings exist with permission "Read"
    And no user settings file exists
    When the developer requests the configuration tree
    Then the response includes project-scope settings
    And the user scope shows a placeholder for the missing settings file
    And no error is reported

  # ===================================================================
  # Error Path: Invalid JSON produces error, other files unaffected
  # ===================================================================

  @error
  Scenario: Malformed settings file shows parse error without affecting other files
    Given user settings contain model preference "sonnet"
    And project settings contain invalid content
    When the developer requests the configuration tree
    Then the project settings file shows a parse error with location details
    And the user settings file displays normally with model "sonnet"
    And the parse error does not prevent other files from loading
