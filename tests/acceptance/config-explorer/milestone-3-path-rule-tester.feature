@skip @US-CE-04
Feature: Path Rule Tester -- Glob Pattern Verification
  As a developer authoring path-scoped rules for my monorepo,
  I want to test whether a file path matches my rule patterns,
  so I can verify rules apply to intended files without trial-and-error.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton: Match and no-match results for a file path
  # ===================================================================

  @walking_skeleton
  Scenario: Developer tests a file path against all rules
    Given the project has the following rules:
      | Rule            | Pattern          |
      | api.md          | src/api/**/*.ts  |
      | testing.md      | **/*.test.ts     |
      | typescript.md   | **/*.ts          |
      | architecture.md | docs/**/*.md     |
    And a user rule "preferences.md" has no path restriction
    When the developer tests the path "src/api/routes/users.ts"
    Then "api.md" shows as MATCH with pattern "src/api/**/*.ts"
    And "typescript.md" shows as MATCH with pattern "**/*.ts"
    And "preferences.md" shows as MATCH because it is unconditional
    And "testing.md" shows as NO MATCH with reason explaining the mismatch
    And "architecture.md" shows as NO MATCH with reason explaining the mismatch

  # ===================================================================
  # Happy Path: Multiple patterns match same file
  # ===================================================================

  Scenario: Test file matches both API and testing rules
    Given the project has rules for "src/api/**/*.ts" and "**/*.test.ts"
    When the developer tests the path "src/api/routes/users.test.ts"
    Then both rules show as MATCH
    And unconditional rules also show as MATCH

  # ===================================================================
  # Happy Path: Rules from both user and project scopes
  # ===================================================================

  Scenario: Rules from both scopes included in test results
    Given the project has a rule with pattern "src/**/*.ts"
    And the user has a rule with no path restriction
    When the developer tests the path "src/utils/helpers.ts"
    Then the project rule shows as MATCH with its pattern
    And the user rule shows as MATCH as unconditional
    And each result indicates the rule's scope

  # ===================================================================
  # Edge Case: All unconditional rules
  # ===================================================================

  @edge
  Scenario: Project with only unconditional rules shows all as matching
    Given only unconditional rules exist with no path restrictions
    When the developer tests the path "src/utils/helpers.ts"
    Then all rules show as MATCH
    And a note indicates no path-scoped rules are configured

  # ===================================================================
  # Edge Case: Negation patterns
  # ===================================================================

  @edge
  Scenario: Rule with negation pattern correctly excludes files
    Given a rule has pattern "src/**/*.ts" with negation "!src/**/*.test.ts"
    When the developer tests the path "src/api/users.test.ts"
    Then the rule shows as NO MATCH with reason explaining the negation exclusion

  # ===================================================================
  # Error Path: Empty file path
  # ===================================================================

  @error
  Scenario: Empty file path produces validation error
    Given the project has rules with path restrictions
    When the developer tests an empty file path
    Then an error indicates that a file path is required

  # ===================================================================
  # Boundary: Deeply nested paths
  # ===================================================================

  @edge
  Scenario: Deeply nested file path matches recursive glob pattern
    Given a rule has pattern "src/**/*.ts"
    When the developer tests the path "src/packages/api/routes/v2/internal/users.ts"
    Then the rule shows as MATCH confirming recursive glob traversal

  @property
  Scenario: Unconditional rules match any valid file path
    Given any rule with no path restriction
    When tested against any valid file path
    Then the rule always shows as MATCH
