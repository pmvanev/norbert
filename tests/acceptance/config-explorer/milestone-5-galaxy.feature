@skip @US-CE-03
Feature: Configuration Relationship Graph (Galaxy)
  As a framework developer managing agents, skills, plugins, and hooks,
  I want to see cross-reference relationships between configuration elements,
  so I can understand my configuration ecosystem without maintaining spreadsheets.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton: Agent-to-skill relationships
  # ===================================================================

  @walking_skeleton
  Scenario: Developer sees agent-to-skill relationships in the model
    Given an agent "solution-architect" references skills "api-patterns", "code-review", and "nw-plugin:formatting"
    And skill "api-patterns" is defined at project scope
    And skill "code-review" is defined at user scope
    When the developer requests the configuration model
    Then the model contains an agent node for "solution-architect"
    And the model contains edges from "solution-architect" to each referenced skill
    And each skill node includes its scope annotation

  # ===================================================================
  # Happy Path: Node type classification
  # ===================================================================

  Scenario: Configuration elements classified by node type
    Given the project has agents, skills, rules, and settings
    When the developer requests the configuration model
    Then agent elements have node type "agent"
    And skill elements have node type "skill"
    And rule elements have node type "rule"
    And settings elements have node type "settings"

  # ===================================================================
  # Happy Path: Plugin components with namespace prefix
  # ===================================================================

  Scenario: Plugin skills show namespace prefix in the model
    Given plugin "nw-plugin" contains skills "formatting" and "lint"
    And plugin "nw-plugin" contains agent "code-reviewer"
    When the developer requests the configuration model
    Then skill nodes show namespaced names "nw-plugin:formatting" and "nw-plugin:lint"
    And the agent node shows "code-reviewer" without namespace prefix

  # ===================================================================
  # Error Path: Naming conflict detected between plugin and project
  # ===================================================================

  @error
  Scenario: Naming conflict detected between plugin and project agent
    Given plugin "nw-plugin" provides agent "code-reviewer"
    And the project also has agent "code-reviewer"
    When the developer requests the configuration model
    Then a naming conflict is reported for "code-reviewer"
    And the conflict resolution indicates that project scope wins

  # ===================================================================
  # Edge Case: Agent references nonexistent skill
  # ===================================================================

  @edge
  Scenario: Agent referencing an undefined skill reported as unresolved
    Given an agent "test-writer" references skill "nonexistent-skill"
    And no skill named "nonexistent-skill" exists at any scope
    When the developer requests the configuration model
    Then the edge from "test-writer" to "nonexistent-skill" is marked as unresolved

  # ===================================================================
  # Boundary: Scope annotations on all nodes
  # ===================================================================

  @edge
  Scenario: Every node in the model includes scope information
    Given configuration files exist at user, project, and plugin scopes
    When the developer requests the configuration model
    Then every node in the model has a scope annotation
    And user-scope nodes are annotated as "user"
    And project-scope nodes are annotated as "project"
    And plugin-scope nodes are annotated as "plugin"

  @property
  Scenario: Every cross-reference in frontmatter produces a relationship edge
    Given any agent with a skills list in its frontmatter
    When the configuration model is assembled
    Then one edge exists for each skill name in the agent's skills list
