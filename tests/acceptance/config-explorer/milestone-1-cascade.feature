@skip @US-CE-01
Feature: Configuration Precedence Waterfall (Cascade)
  As a senior developer debugging why my configuration is not taking effect,
  I want to see which value wins at each scope level and why others are overridden,
  so I can resolve configuration conflicts in seconds instead of minutes.

  Background:
    Given the Config Explorer server is running with synthetic configuration

  # ===================================================================
  # Walking Skeleton: Cascade shows active vs overridden hooks
  # ===================================================================

  @walking_skeleton
  Scenario: Hook override identified via cascade waterfall
    Given hooks for "PreToolUse/Bash" are defined at local, project, and user scopes
    And the local scope hook runs "./scripts/lint-bash.sh"
    And the project scope hook runs "./scripts/validate-bash.sh"
    And the user scope hook runs "http://localhost:8080/hooks"
    When the developer requests the precedence cascade for "hooks"
    Then the local hook is marked ACTIVE
    And the project hook is marked OVERRIDDEN
    And the user hook is marked OVERRIDDEN
    And the project hook override reason reads "Overridden by LOCAL scope"

  # ===================================================================
  # Happy Path: CLAUDE.md accumulation (additive, not override)
  # ===================================================================

  Scenario: Memory files shown as additive in the cascade
    Given CLAUDE.md files exist at user, project, and local scopes
    And the user CLAUDE.md contains "Use TypeScript always"
    And the project CLAUDE.md contains "Use Fastify 5 patterns"
    And the local CLAUDE.md contains "Skip tests for now"
    When the developer requests the precedence cascade for "memory"
    Then all 3 memory files are marked ACTIVE
    And a note explains that memory files are additive
    And the files are ordered by precedence with local first and user last

  # ===================================================================
  # Happy Path: Array settings merge behavior
  # ===================================================================

  Scenario: Permission settings show merged values with source tagging
    Given project settings allow "Bash(npm *)"
    And user settings allow "Read", "Glob", and "Grep"
    When the developer requests the precedence cascade for "settings"
    Then the effective permissions include all 4 values merged
    And "Bash(npm *)" is tagged as coming from the project scope
    And "Read", "Glob", and "Grep" are tagged as coming from the user scope

  # ===================================================================
  # Happy Path: Subsystem selector
  # ===================================================================

  Scenario: Cascade supports all 7 subsystem categories
    Given configuration exists across multiple subsystems
    When the developer requests the precedence cascade for each subsystem
    Then cascades are available for memory, settings, rules, skills, agents, hooks, and MCP

  # ===================================================================
  # Edge Case: On-demand items labeled distinctly
  # ===================================================================

  @edge
  Scenario: Subdirectory memory file labeled as loaded on-demand
    Given a CLAUDE.md file exists in the packages/api/ subdirectory
    And project-root CLAUDE.md and user CLAUDE.md also exist
    When the developer requests the precedence cascade for "memory"
    Then the subdirectory CLAUDE.md appears with label "Loaded on-demand at runtime"
    And the project-root and user files do not have the on-demand label

  # ===================================================================
  # Error Path: Managed settings inaccessible
  # ===================================================================

  @error
  Scenario: Managed scope shows access denied when permissions are insufficient
    Given managed settings require elevated permissions not available to the server
    When the developer requests the precedence cascade for "settings"
    Then the managed scope shows "access denied"
    And all other scope levels display their configuration normally

  # ===================================================================
  # Error Path: Empty subsystem in cascade
  # ===================================================================

  @error
  Scenario: Cascade for unconfigured subsystem shows all scopes as empty
    Given no MCP servers are configured at any scope
    When the developer requests the precedence cascade for "mcp"
    Then all scope levels show as empty
    And no error is reported

  # ===================================================================
  # Boundary: Override reason specificity
  # ===================================================================

  @edge
  Scenario: Override reason identifies the specific overriding file
    Given a hook is defined in both project and local settings files
    When the developer requests the precedence cascade for "hooks"
    Then the override reason for the project hook includes the local settings file path
