@skip @US-CE-02
Feature: Configuration Anatomy Tree (Atlas)
  As a newcomer joining a project with unfamiliar configuration,
  I want to see all configuration files organized by scope with content previews,
  so I can understand the full configuration landscape without reading documentation.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton: Full tree with scope annotations
  # ===================================================================

  @walking_skeleton
  Scenario: Developer sees complete configuration tree with scope annotations
    Given the project has 14 configuration files across user and project scopes
    And user scope has 4 files including CLAUDE.md, settings, and 2 rules
    And project scope has 10 files including settings, rules, agents, and skills
    When the developer requests the configuration tree
    Then the tree shows user-scope files annotated as "user"
    And the tree shows project-scope files annotated as "project"
    And each file includes its subsystem classification

  # ===================================================================
  # Happy Path: Content preview with frontmatter annotation
  # ===================================================================

  Scenario: Rule file content includes path scope annotation
    Given a project rule "api.md" has path scope "src/api/**/*.ts"
    When the developer requests the configuration tree
    Then the api.md entry includes content with the rule body
    And the entry includes an annotation reading "Applies to files matching: src/api/**/*.ts"

  # ===================================================================
  # Happy Path: Subsystem classification
  # ===================================================================

  Scenario: Files classified by subsystem type
    Given the project has rules, agents, skills, and settings files
    When the developer requests the configuration tree
    Then rule files are classified as subsystem "rules"
    And agent files are classified as subsystem "agents"
    And skill files are classified as subsystem "skills"
    And settings files are classified as subsystem "settings"

  # ===================================================================
  # Edge Case: Missing directories shown as unconfigured
  # ===================================================================

  @edge
  Scenario: Expected but missing directories indicated in tree
    Given the user scope has no agents directory
    And the user scope has no skills directory
    When the developer requests the configuration tree
    Then the user-scope tree indicates that agents are not configured
    And the user-scope tree indicates that skills are not configured
    And the indicators include a descriptive tooltip

  # ===================================================================
  # Error Path: Malformed file with error badge
  # ===================================================================

  @error
  Scenario: Malformed settings file shown with parse error in tree
    Given project settings contain invalid content
    And a project rule "api.md" has valid content
    When the developer requests the configuration tree
    Then the settings file entry includes a parse error with location
    And the api.md rule entry displays normally with its content
    And the parse error is isolated to the affected file

  # ===================================================================
  # Error Path: Empty project directory
  # ===================================================================

  @error
  Scenario: Project with no .claude/ directory shows available subsystems
    Given the project has only a root CLAUDE.md and no .claude/ directory
    When the developer requests the configuration tree
    Then the root CLAUDE.md appears in the project scope
    And all standard subsystem directories are shown as unconfigured
