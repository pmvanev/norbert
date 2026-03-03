Feature: Config Explorer -- Claude Code Configuration Observatory
  As a Claude Code user with configuration across multiple scopes and subsystems,
  I want to visually navigate, understand, and debug my .claude configuration ecosystem,
  so I can manage configuration confidently instead of through trial-and-error.

  Background:
    Given the Norbert server is running on localhost
    And the Norbert dashboard is accessible in the browser
    And Config Explorer has scanned the filesystem for configuration files

  # =========================================================================
  # Config Atlas (Anatomy View) -- JS-01, JS-07
  # =========================================================================

  Scenario: Kenji sees the full configuration tree for a project
    Given Kenji Tanaka has the following configuration files:
      | Path                              | Scope   | Subsystem |
      | ~/.claude/CLAUDE.md               | User    | Memory    |
      | ~/.claude/settings.json           | User    | Settings  |
      | ~/.claude/rules/preferences.md    | User    | Rules     |
      | ~/.claude/rules/workflows.md      | User    | Rules     |
      | .claude/settings.json             | Project | Settings  |
      | ./CLAUDE.md                       | Project | Memory    |
      | .claude/rules/api.md              | Project | Rules     |
      | .claude/rules/testing.md          | Project | Rules     |
      | .claude/rules/typescript.md       | Project | Rules     |
      | .claude/rules/architecture.md     | Project | Rules     |
      | .claude/agents/code-reviewer.md   | Project | Agents    |
      | .claude/agents/test-writer.md     | Project | Agents    |
      | .claude/skills/api-patterns/SKILL.md | Project | Skills |
      | .claude/skills/testing/SKILL.md   | Project | Skills    |
    When Kenji opens the Config Atlas view
    Then the tree displays ~/.claude/ with 4 files in blue (user scope)
    And the tree displays .claude/ with 10 files in green (project scope)
    And each file shows a subsystem icon (rules, skills, agents, etc.)

  Scenario: Kenji previews a rule file with path-scoped frontmatter
    Given the project has .claude/rules/api.md with frontmatter:
      """
      ---
      paths:
        - "src/api/**/*.ts"
      ---
      # API Conventions
      Use Fastify 5 patterns for all API routes.
      """
    When Kenji clicks "api.md" in the Atlas tree
    Then the content preview pane shows the file contents with syntax highlighting
    And the frontmatter annotation reads "Applies to files matching: src/api/**/*.ts"
    And a "Test a file path" link is available to navigate to the Path Rule Tester

  Scenario: Kenji discovers unconfigured subsystems via missing file indicators
    Given Kenji has no personal agents in ~/.claude/agents/
    And Kenji has no personal skills in ~/.claude/skills/
    When Kenji views the Atlas and expands ~/.claude/
    Then "agents/" appears dimmed with tooltip "No personal agents configured"
    And "skills/" appears dimmed with tooltip "No personal skills configured"
    And clicking a dimmed directory shows a description and documentation link

  # =========================================================================
  # Config Mind Map -- JS-01, JS-07
  # =========================================================================

  Scenario: Kenji views the mind map to understand config structure at a glance
    Given Kenji's project has 14 configuration files across 7 subsystems
    When Kenji opens the Mind Map view
    Then 8 primary branches are displayed: Memory, Settings, Rules, Skills, Agents, Hooks, Plugins, MCP
    And each branch shows element count (e.g., "Rules (6)")
    And element counts break down by scope with consistent color coding
    And the total element count matches the landing page summary

  Scenario: Kenji collapses and expands mind map branches
    Given the Mind Map shows 8 branches with elements
    When Kenji clicks to collapse the "Rules" branch
    Then the branch shows only the summary count "Rules (6)"
    And when Kenji clicks to expand it again
    Then individual rule nodes reappear with scope coloring

  # =========================================================================
  # Config Cascade (Precedence Waterfall) -- JS-02
  # =========================================================================

  Scenario: Ravi finds why his project hook is overridden by a local hook
    Given Ravi Patel has the following hooks configuration:
      | Scope   | File                          | Event       | Matcher | Command               |
      | Local   | .claude/settings.local.json   | PreToolUse  | Bash    | ./scripts/lint-bash.sh |
      | Project | .claude/settings.json         | PreToolUse  | Bash    | ./scripts/validate-bash.sh |
      | User    | ~/.claude/settings.json       | PreToolUse  | Bash    | http://localhost:8080/hooks |
    When Ravi opens the Cascade view and selects the "Hooks" subsystem
    And filters to "PreToolUse" event
    Then the waterfall displays 3 scope levels with hook definitions
    And the local hook (./scripts/lint-bash.sh) is marked ACTIVE
    And the project hook (./scripts/validate-bash.sh) is marked OVERRIDDEN
    And the user hook is marked OVERRIDDEN
    And the override reason for project reads "Overridden by LOCAL scope (.claude/settings.local.json)"

  Scenario: Ravi views settings precedence for permissions (array merge)
    Given the project .claude/settings.json has permissions.allow: ["Bash(npm *)"]
    And ~/.claude/settings.json has permissions.allow: ["Read", "Glob", "Grep"]
    When Ravi opens the Cascade view for "Settings" subsystem
    And navigates to permissions.allow
    Then the cascade shows array merge behavior
    And effective permissions are the union: ["Bash(npm *)", "Read", "Glob", "Grep"]
    And each permission shows its source scope

  Scenario: Ravi views CLAUDE.md precedence hierarchy
    Given the following CLAUDE.md files exist:
      | Scope   | Path                    | Content snippet           |
      | User    | ~/.claude/CLAUDE.md     | "Use TypeScript always"   |
      | Project | ./CLAUDE.md             | "Use Fastify 5 patterns"  |
      | Local   | ./CLAUDE.local.md       | "Skip tests for now"      |
    When Ravi opens the Cascade view for "Memory" subsystem
    Then the waterfall shows 3 CLAUDE.md files ordered by precedence
    And all 3 are marked ACTIVE (CLAUDE.md files accumulate, not override)
    And the ordering shows: Local (highest personal precedence) > Project > User
    And a note explains "CLAUDE.md files are additive -- all are loaded, not overridden"

  Scenario: Cascade shows on-demand items with runtime label
    Given the project has a subdirectory packages/api/CLAUDE.md
    When Ravi views the Cascade for "Memory" subsystem
    Then the subdirectory CLAUDE.md appears with label "Loaded on-demand at runtime"
    And a tooltip explains "This file loads when Claude reads files in packages/api/"

  # =========================================================================
  # Config Galaxy (Relationship Graph) -- JS-03, JS-05
  # =========================================================================

  Scenario: Sofia sees agent-to-skill relationships in the graph
    Given Sofia Hernandez has an agent "solution-architect" with skills: ["api-patterns", "code-review", "nw-plugin:formatting"]
    When Sofia opens the Galaxy view
    And clicks the "solution-architect" node (green hexagon)
    Then 3 edges highlight connecting to skill nodes
    And "api-patterns" is a green circle (project scope)
    And "code-review" is a blue circle (user scope)
    And "nw-plugin:formatting" is a purple circle (plugin scope)
    And the detail panel shows: "Agent: solution-architect | Scope: Project | Skills: 3"

  Scenario: Sofia filters the graph by subsystem
    Given Sofia's configuration has 46 elements across all subsystems
    When Sofia selects the "Agents+Skills" filter in Galaxy
    Then only agent nodes and skill nodes are displayed
    And edges between agents and skills are visible
    And all other nodes (rules, hooks, MCP, settings) are hidden
    And element count updates to show the filtered count

  Scenario: Carlos expands a plugin to see its components
    Given Carlos Rivera's plugin "nw-plugin" contains:
      | Component     | Name          | Type   |
      | skill         | formatting    | Skill  |
      | skill         | lint          | Skill  |
      | agent         | code-reviewer | Agent  |
      | hook          | pre-bash      | Hook   |
    When Carlos clicks the "nw-plugin" star node in Galaxy
    Then the plugin expands to reveal 4 child nodes
    And skill nodes show namespaced names: "nw-plugin:formatting", "nw-plugin:lint"
    And the agent node shows "code-reviewer" (not namespaced -- agents are not namespaced)

  Scenario: Carlos sees a naming conflict between plugin and project agent
    Given Carlos's plugin provides agent "code-reviewer"
    And the project has .claude/agents/code-reviewer.md
    When Carlos views the Galaxy with plugin expanded
    Then a red edge connects the two "code-reviewer" nodes
    And the conflict tooltip reads "Naming conflict: project scope (.claude/agents/code-reviewer.md) takes precedence over plugin agent"
    And the project agent node has a conflict badge

  # =========================================================================
  # Path Rule Tester -- JS-04
  # =========================================================================

  Scenario: Mei-Lin tests which rules match a specific file path
    Given the project has the following rules:
      | File                          | Paths Frontmatter    |
      | .claude/rules/api.md          | src/api/**/*.ts      |
      | .claude/rules/testing.md      | **/*.test.ts         |
      | .claude/rules/typescript.md   | **/*.ts              |
      | .claude/rules/architecture.md | docs/**/*.md         |
      | ~/.claude/rules/preferences.md | (none -- unconditional) |
    When Mei-Lin Chen enters "src/api/routes/users.ts" in the Path Rule Tester
    Then the following results are displayed:
      | Rule              | Status   | Pattern          | Reason                          |
      | api.md            | MATCH    | src/api/**/*.ts  | Pattern matches file path       |
      | typescript.md     | MATCH    | **/*.ts          | Pattern matches file path       |
      | preferences.md    | MATCH    | (unconditional)  | No paths restriction            |
      | testing.md        | NO MATCH | **/*.test.ts     | "users.ts" does not end with ".test.ts" |
      | architecture.md   | NO MATCH | docs/**/*.md     | "src/api/" is not under "docs/" |

  Scenario: Mei-Lin tests a path that matches no scoped rules
    Given only unconditional rules exist
    When Mei-Lin enters "src/utils/helpers.ts" in the Path Rule Tester
    Then all unconditional rules show as MATCH
    And a message reads "No path-scoped rules match this file. Only unconditional rules apply."

  Scenario: Mei-Lin navigates from Path Tester to Atlas to view a matching rule
    Given the Path Tester shows api.md as MATCH for "src/api/routes/users.ts"
    When Mei-Lin clicks "View file" on the api.md result
    Then Config Explorer navigates to Atlas with api.md selected
    And the content preview shows the rule's frontmatter and instructions

  # =========================================================================
  # Configuration Search -- JS-08
  # =========================================================================

  Scenario: Sofia searches for all hooks defined across her configuration
    Given Sofia's configuration defines hooks in 3 files across 3 scopes
    When Sofia opens Search and enters "PreToolUse"
    Then 3 results are displayed with scope badges and subsystem icons
    And each result shows the file path, matching line, and scope color
    And clicking a result navigates to that file in the Atlas view

  Scenario: Search returns no results for a non-existent term
    Given the configuration files do not contain the term "kubernetes"
    When Sofia searches for "kubernetes"
    Then a message reads "No configuration files contain 'kubernetes'"
    And suggestions appear: "Try searching for a setting name, rule keyword, or skill name"

  # =========================================================================
  # Landing Page and Navigation -- Cross-cutting
  # =========================================================================

  Scenario: Config Explorer shows scanning progress on first load
    Given the config parser has not yet completed
    When the user navigates to the Config Explorer tab
    Then a progress indicator shows "Scanning configuration files..."
    And the indicator completes within 2 seconds for typical configurations
    And views become interactive only after scanning completes

  Scenario: Consistent scope coloring across all views
    Given the user has viewed configuration in Atlas, Mind Map, Galaxy, and Cascade
    Then user-scope items are blue in all four views
    And project-scope items are green in all four views
    And local-scope items are yellow in all four views
    And plugin-scope items are purple in all four views
    And managed-scope items are red in all four views

  Scenario: View-to-view navigation preserves context
    Given Ravi is viewing the Cascade for the "Hooks" subsystem
    When Ravi clicks "View file" on the active hook entry
    Then Config Explorer navigates to Atlas
    And the relevant file is selected in the tree
    And the content preview shows the hook definition
    And the breadcrumb reads "Config Explorer > Atlas > .claude/settings.local.json"

  # =========================================================================
  # Error Paths and Edge Cases
  # =========================================================================

  Scenario: Config Explorer handles missing .claude/ directory gracefully
    Given a project has no .claude/ directory (only root CLAUDE.md)
    When the user opens Config Explorer
    Then the Atlas shows only ~/.claude/ tree and the root CLAUDE.md
    And the Mind Map shows active subsystems with counts
    And empty subsystems show "Not configured" rather than an error

  Scenario: Config Explorer handles unreadable managed settings
    Given managed settings at the platform path require elevated permissions
    And the Norbert process does not have elevated permissions
    When Config Explorer scans for configuration
    Then the managed scope shows "Managed settings: access denied (requires admin privileges)"
    And all other scopes display normally
    And no error prevents the user from using other features

  Scenario: Config Explorer handles malformed configuration files
    Given .claude/settings.json contains invalid JSON
    When Config Explorer parses configuration files
    Then the Atlas shows settings.json with an error badge
    And the content preview reads "Parse error: invalid JSON at line 5, column 12"
    And all other files parse and display normally
    And the Cascade shows "Parse error" for the affected scope level

  Scenario: Config Explorer handles very large configurations (performance)
    Given a project with 100+ configuration elements (files, rules, skills, agents)
    When the user opens the Galaxy view
    Then the graph renders within 2 seconds
    And nodes are interactive (clickable, draggable) without perceptible lag
    And subsystem filtering reduces visible nodes to a manageable subset
