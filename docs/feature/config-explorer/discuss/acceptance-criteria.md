# Acceptance Criteria: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 4 (Requirements Crafting)
**Date**: 2026-03-03

---

## AC Traceability Matrix

Every acceptance criterion traces to a UAT scenario, which traces to a job story, which traces to an opportunity score.

---

## US-CE-01: Configuration Precedence Waterfall

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-01-01 | Cascade displays all 5 scope levels (managed, CLI, local, project, user) for each subsystem | Hook override, CLAUDE.md accumulation | Given any subsystem selected, Then 5 scope levels shown (empty if no config at that scope) |
| AC-01-02 | ACTIVE marker on the winning/effective configuration value | Hook override | Given conflicting hooks at 2 scopes, Then exactly 1 is marked ACTIVE |
| AC-01-03 | OVERRIDDEN marker with strikethrough on suppressed values | Hook override | Given a lower-scope value overridden by higher scope, Then value has OVERRIDDEN marker and strikethrough |
| AC-01-04 | Override reason explains which scope and file caused the override | Hook override | Given Ravi's project hook overridden by local, Then reason reads "Overridden by LOCAL scope (.claude/settings.local.json)" |
| AC-01-05 | CLAUDE.md files shown as additive (all ACTIVE, not overridden) | CLAUDE.md accumulation | Given 3 CLAUDE.md files at different scopes, Then all 3 marked ACTIVE with note "CLAUDE.md files are additive" |
| AC-01-06 | Array settings show merge behavior with source tagging | Permissions array merge | Given permissions.allow defined at user and project scopes, Then effective value is the union with each permission tagged to source |
| AC-01-07 | Managed settings degrade gracefully when access denied | Managed settings inaccessible | Given managed path not readable, Then managed scope shows "access denied" and other scopes display normally |
| AC-01-08 | On-demand items labeled "Loaded on-demand at runtime" | On-demand items | Given subdirectory CLAUDE.md or path-scoped rules, Then labeled distinctly from always-loaded items |
| AC-01-09 | Subsystem selector covers Memory, Settings, Rules, Skills, Agents, Hooks, MCP | All scenarios | Given Cascade view open, Then 7 subsystem tabs are available |

---

## US-CE-02: Configuration Anatomy Tree

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-02-01 | Dual-pane tree shows ~/.claude/ and .claude/ directories | Browse config tree | Given both directories exist, Then two tree panes rendered side by side |
| AC-02-02 | User-scope items rendered in blue | Browse config tree | Given ~/.claude/CLAUDE.md, Then tree item background/icon is blue (#3B82F6) |
| AC-02-03 | Project-scope items rendered in green | Browse config tree | Given .claude/rules/api.md, Then tree item is green (#22C55E) |
| AC-02-04 | Subsystem icons distinguish file types | Browse config tree | Given a rules file and a skills file, Then different icons displayed (square vs circle or equivalent) |
| AC-02-05 | Content preview pane shows file contents with syntax highlighting | Preview path-scoped rule | Given Kenji clicks api.md, Then right pane shows contents with Markdown/YAML syntax highlighting |
| AC-02-06 | YAML frontmatter `paths:` annotated as "Applies to files matching: {pattern}" | Preview path-scoped rule | Given rule has paths: ["src/api/**/*.ts"], Then annotation reads "Applies to files matching: src/api/**/*.ts" |
| AC-02-07 | Missing/empty directories shown dimmed with descriptive tooltip | Discover unconfigured subsystems | Given ~/.claude/agents/ does not exist, Then "agents/" appears dimmed with tooltip describing agents |
| AC-02-08 | Clicking dimmed directory shows description and documentation link | Discover unconfigured subsystems | Given Kenji clicks dimmed "agents/", Then description and doc link displayed |
| AC-02-09 | Malformed files display error badge with parse error location | Malformed file handling | Given invalid JSON in settings.json, Then error badge shown with "Parse error at line 5, column 12" |
| AC-02-10 | Other files unaffected by malformed file in same scan | Malformed file handling | Given settings.json has error, Then all other config files display normally |

---

## US-CE-03: Configuration Relationship Graph

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-03-01 | Nodes shaped by type: hexagon=agent, circle=skill, square=rule, diamond=hook, pentagon=MCP, star=plugin | All Galaxy scenarios | Given an agent and a skill in the graph, Then agent is hexagon shaped and skill is circle shaped |
| AC-03-02 | Nodes colored by scope | Agent-to-skill | Given a user-scope skill and a project-scope agent, Then skill node is blue and agent node is green |
| AC-03-03 | Edges connect agents to referenced skills | Agent-to-skill | Given agent has skills: ["api-patterns"], Then edge exists between agent node and api-patterns node |
| AC-03-04 | Subsystem filter hides non-matching node types | Filter by subsystem | Given "Agents+Skills" filter active, Then only agent and skill nodes visible |
| AC-03-05 | Plugin star node expands to reveal contained components | Plugin explosion | Given plugin has 3 skills and 2 agents, Then clicking star reveals 5 child nodes |
| AC-03-06 | Plugin skills show namespace prefix | Plugin explosion | Given plugin "nw-plugin" has skill "format", Then node label is "nw-plugin:format" |
| AC-03-07 | Naming conflicts shown with red edge | Naming conflict | Given plugin and project both have agent "code-reviewer", Then red edge between nodes |
| AC-03-08 | Conflict tooltip explains resolution | Naming conflict | Given naming conflict, Then tooltip reads "Naming conflict: project scope wins" |
| AC-03-09 | Detail panel shows metadata on node click | Agent-to-skill | Given Sofia clicks agent node, Then panel shows name, scope, skills, model |
| AC-03-10 | Graph renders within 2 seconds for 100 nodes | Performance | Given 100 configuration elements, Then graph interactive within 2 seconds |

---

## US-CE-04: Path Rule Tester

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-04-01 | Text input accepts a file path relative to project root | All Path Tester scenarios | Given Mei-Lin types "src/api/routes/users.ts", Then input accepted |
| AC-04-02 | Results show MATCH for rules whose glob pattern matches | Test file path | Given pattern "src/api/**/*.ts" and path "src/api/routes/users.ts", Then MATCH shown |
| AC-04-03 | Results show NO MATCH with specific mismatch reason | Test file path | Given pattern "docs/**/*.md" and path "src/api/routes/users.ts", Then NO MATCH with reason "not under docs/" |
| AC-04-04 | Unconditional rules (no paths: frontmatter) always show MATCH | Test file path | Given rule with no paths: field, Then shown as MATCH with note "Unconditional" |
| AC-04-05 | Click "View file" navigates to Atlas with rule selected | Navigate to Atlas | Given MATCH shown for api.md, Then clicking "View file" opens Atlas at api.md |
| AC-04-06 | Rules from both user and project scopes included in results | Test file path | Given user rules in ~/.claude/rules/ and project rules in .claude/rules/, Then both shown |
| AC-04-07 | Glob matching compatible with picomatch semantics | All | Given patterns using **, *, ?, {a,b}, Then matching behavior identical to picomatch |

---

## US-CE-05: Configuration Mind Map

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-05-01 | 8 primary branches: Memory, Settings, Rules, Skills, Agents, Hooks, Plugins, MCP | View mind map | Given any config, Then 8 branches displayed |
| AC-05-02 | Element counts per branch match Atlas and landing page | View mind map | Given 6 rules in Atlas, Then Rules branch shows (6) |
| AC-05-03 | Scope coloring consistent with other views | View mind map | Given user-scope rule, Then node is blue (same as Atlas) |
| AC-05-04 | Branches expand to show individual elements | Expand branch | Given Rules (6), Then expanding shows 6 rule nodes |
| AC-05-05 | Branches collapse to show summary count | Collapse branch | Given expanded Rules branch, Then collapsing shows "Rules (6)" |
| AC-05-06 | Empty subsystems shown dimmed with zero count | Minimal config | Given no agents configured, Then Agents (0) shown dimmed |

---

## US-CE-06: Configuration Search

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-06-01 | Search covers all configuration files across all scopes | Search hooks | Given hooks in 3 files, Then search for "PreToolUse" returns 3 results |
| AC-06-02 | Results show file path, scope badge, subsystem icon, matching line | Search hooks | Given result for .claude/settings.json, Then shows path + green badge + hooks icon + line |
| AC-06-03 | Click result navigates to file in Atlas | Search hooks | Given Sofia clicks result, Then Atlas opens with file selected |
| AC-06-04 | No-results state shows guidance message | No results | Given search for "kubernetes" with no matches, Then guidance message displayed |
| AC-06-05 | Cmd+K / Ctrl+K opens search from any view | Keyboard shortcut | Given user on Galaxy view, Then Cmd+K focuses search input |
| AC-06-06 | Search returns results within 500ms | Performance | Given typical config (50 files), Then results displayed within 500ms |

---

## US-CE-07: Walking Skeleton

| AC ID | Criterion | From Scenario | Testable |
|-------|-----------|---------------|----------|
| AC-07-01 | API endpoint returns parsed settings.json from user and project scopes | Two-scope display | Given both settings files exist, Then GET /api/config/settings returns both with scope annotations |
| AC-07-02 | Svelte tree renders user settings in blue, project settings in green | Two-scope display | Given API response with scope annotations, Then tree items colored by scope |
| AC-07-03 | Missing settings file produces placeholder, not error | Missing file | Given ~/.claude/settings.json not found, Then placeholder shown |
| AC-07-04 | Invalid JSON produces error badge | Invalid JSON | Given .claude/settings.json with syntax error, Then error badge and message |
| AC-07-05 | End-to-end data flow operational: filesystem -> parser -> API -> UI | All | Given valid settings files, Then user sees rendered tree within 2 seconds of page load |

---

## Cross-Cutting Acceptance Criteria

These apply to ALL stories and are not repeated per story.

| AC ID | Criterion | Testable |
|-------|-----------|----------|
| AC-XX-01 | Scope colors identical across Atlas, Mind Map, Galaxy, Cascade, Search, and legend | Visual regression: same element same color in all views |
| AC-XX-02 | Element counts consistent between Mind Map branch counts and Atlas file counts | Sum of Atlas files per subsystem equals Mind Map branch count |
| AC-XX-03 | View-to-view navigation preserves context (selected subsystem, element) | Navigate from Cascade to Atlas: correct file selected |
| AC-XX-04 | Breadcrumb shows: Config Explorer > View > Element | Given navigation to Atlas > api.md, Then breadcrumb reads accordingly |
| AC-XX-05 | All text uses Claude Code vocabulary (see CLI Vocabulary in shared-artifacts-registry.md) | No instances of "extension" (should be "plugin"), "command" (should be "skill"), etc. |
| AC-XX-06 | Config Explorer is read-only -- no file modification capabilities | No edit, create, or delete operations available in any view |
| AC-XX-07 | WCAG 2.2 AA: keyboard navigation, 4.5:1 contrast, focus indicators, labels | All interactive elements reachable via Tab key, contrast verified |
