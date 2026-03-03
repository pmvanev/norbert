# User Stories: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 4 (Requirements Crafting)
**Date**: 2026-03-03

---

## US-CE-01: Configuration Precedence Waterfall

### Problem
Ravi Patel is a senior developer managing a monorepo with 5 CLAUDE.md files, path-scoped rules, and hooks defined in 3 locations. He finds it maddening to debug configuration overrides because the 5-level precedence hierarchy is invisible. He has spent 30+ minutes tracing why a hook does not fire, only to discover a local settings override was suppressing his project hook. He currently traces precedence mentally from documentation, adding echo statements to verify which config is active.

### Who
- Senior developer | Multi-scope configuration (user + project + local) | Wants to stop guessing about precedence

### Solution
A CSS DevTools-inspired cascade waterfall showing, for any subsystem, which configuration is defined at each scope level, which one "wins" (ACTIVE), and which are suppressed (OVERRIDDEN with reason).

### Domain Examples

#### 1: Hook Override Debug (Happy Path)
Ravi has a `PreToolUse/Bash` hook in `.claude/settings.json` (project scope) that validates bash commands. His colleague added a `PreToolUse/Bash` hook in `.claude/settings.local.json` (local scope) for linting. Ravi opens the Cascade, selects "Hooks," and immediately sees: the local hook is ACTIVE, his project hook is OVERRIDDEN with reason "Overridden by LOCAL scope." Problem solved in 30 seconds.

#### 2: CLAUDE.md Accumulation (Edge Case)
Ravi has CLAUDE.md files at `~/.claude/CLAUDE.md`, `./CLAUDE.md`, and `./CLAUDE.local.md`. He opens the Cascade for "Memory." The waterfall shows all 3 files as ACTIVE because CLAUDE.md files accumulate (they are additive, not override). The cascade displays them in precedence order with a note: "CLAUDE.md files are additive -- all loaded, instructions merge."

#### 3: Permissions Array Merge (Edge Case)
Ravi's project `.claude/settings.json` allows `Bash(npm *)`. His user `~/.claude/settings.json` allows `Read, Glob, Grep`. He opens Cascade for "Settings" and navigates to `permissions.allow`. The cascade shows array merge behavior: effective permissions are the union `["Bash(npm *)", "Read", "Glob", "Grep"]`, with each permission tagged to its source scope.

#### 4: Managed Settings Inaccessible (Error/Boundary)
Ravi's organization has managed settings at the platform path but Norbert does not have admin privileges. The Cascade shows the managed scope with "Access denied (requires admin privileges)" and all other scopes display normally.

### UAT Scenarios (BDD)

#### Scenario: Hook override identified via cascade
Given Ravi Patel has hooks for PreToolUse/Bash defined in both .claude/settings.json and .claude/settings.local.json
When Ravi opens the Cascade view and selects "Hooks" subsystem
Then the local hook (settings.local.json) is marked ACTIVE
And the project hook (settings.json) is marked OVERRIDDEN
And the override reason reads "Overridden by LOCAL scope (.claude/settings.local.json)"

#### Scenario: CLAUDE.md files shown as additive in cascade
Given Ravi has CLAUDE.md files at ~/.claude/CLAUDE.md, ./CLAUDE.md, and ./CLAUDE.local.md
When Ravi opens the Cascade view and selects "Memory" subsystem
Then all 3 CLAUDE.md files are shown as ACTIVE
And a note explains "CLAUDE.md files are additive -- all are loaded"
And the files are ordered by precedence (local > project > user)

#### Scenario: Array settings show merge behavior
Given project settings have permissions.allow: ["Bash(npm *)"]
And user settings have permissions.allow: ["Read", "Glob", "Grep"]
When Ravi views the Cascade for "Settings" and navigates to permissions.allow
Then the effective value shows the merged array: ["Bash(npm *)", "Read", "Glob", "Grep"]
And each permission is tagged with its source scope

#### Scenario: Managed settings access denied
Given managed settings require admin privileges not available to Norbert
When Ravi opens the Cascade view
Then the managed scope shows "Managed settings: access denied (requires admin privileges)"
And all other scope levels display their configuration normally

#### Scenario: On-demand items labeled in cascade
Given the project has packages/api/CLAUDE.md (loaded on-demand)
When Ravi views the Cascade for "Memory" subsystem
Then the subdirectory CLAUDE.md appears with label "Loaded on-demand at runtime"

### Acceptance Criteria
- [ ] Cascade displays all 5 scope levels (managed, CLI, local, project, user) for each subsystem
- [ ] ACTIVE and OVERRIDDEN markers clearly distinguish winning vs. suppressed values
- [ ] Override reason explains which higher-precedence scope caused the override
- [ ] CLAUDE.md accumulation behavior shown correctly (additive, not override)
- [ ] Array settings (permissions) show merge behavior with source tagging
- [ ] Managed settings degrade gracefully when access is denied
- [ ] On-demand items labeled distinctly from always-loaded items
- [ ] Subsystem selector covers all 7 subsystems (memory, settings, rules, skills, agents, hooks, MCP)

### Technical Notes
- Precedence resolution is a pure function: given a set of parsed files with scope annotations, produce the precedence chain
- Must follow documented order from Research Finding 12 (see BR-01 in requirements.md)
- Settings precedence and CLAUDE.md precedence use different resolution logic (override vs. accumulation)
- Dependency: FR-01 (config parser) must be complete before Cascade can render

### Job Traces
- JS-02 (Debug why config not taking effect)
- O-07, O-08, O-11, O-12 (all scored 17 -- highest opportunity)

---

## US-CE-02: Configuration Anatomy Tree

### Problem
Kenji Tanaka is a mid-level developer who joined the norbert-nwave project 2 weeks ago. He finds it overwhelming to understand the configuration landscape -- files scattered across `~/.claude/` and `.claude/` with 7 subsystems he has never seen enumerated in one place. He currently uses `ls -R` and IDE file browsing but gets no context about scope, subsystem, or what files do. He does not know about agents, skills, or hooks because he has never seen them listed alongside the config files he does know about.

### Who
- New team member | Unfamiliar with project configuration | Wants to see everything at once

### Solution
A navigable dual-pane tree of `~/.claude/` and `.claude/` with scope coloring, subsystem icons, content preview, and missing file indicators for unconfigured subsystems.

### Domain Examples

#### 1: Browse Full Configuration Tree (Happy Path)
Kenji opens Config Atlas and sees two trees side by side: `~/.claude/` (user, blue) and `.claude/` (project, green). He expands `.claude/rules/` and sees 4 rule files, each with a rules icon. He clicks `api.md` and the right pane shows the file content with frontmatter annotation: "Applies to files matching: src/api/**/*.ts." He learns a path-scoped rule exists that he did not know about.

#### 2: Discover Unconfigured Subsystems (Newcomer Value)
Kenji expands `~/.claude/` and sees `agents/` dimmed with tooltip "No personal agents configured. Agents are specialized AI assistants you can define for recurring tasks." He also sees `skills/` dimmed. Clicking the dimmed directory shows a description and a link to documentation. Kenji decides to create his first personal skill.

#### 3: Malformed File Handling (Error/Boundary)
The project's `.claude/settings.json` has a JSON syntax error. Config Atlas shows the file with a red error badge. The content preview reads "Parse error: Unexpected token at line 5, column 12. Other configuration files are not affected." All other files display normally.

### UAT Scenarios (BDD)

#### Scenario: Kenji browses the complete config tree
Given Kenji Tanaka's project has 14 configuration files across user and project scopes
When Kenji opens the Config Atlas view
Then the tree displays ~/.claude/ with entries in blue (user scope)
And the tree displays .claude/ with entries in green (project scope)
And each entry shows a subsystem icon (rules, skills, agents, settings, memory)

#### Scenario: Kenji previews a path-scoped rule
Given .claude/rules/api.md has frontmatter paths: ["src/api/**/*.ts"]
When Kenji clicks "api.md" in the project rules tree
Then the content preview shows the rule body with syntax highlighting
And an annotation reads "Applies to files matching: src/api/**/*.ts"

#### Scenario: Kenji discovers available but unconfigured subsystems
Given ~/.claude/agents/ does not exist
When Kenji expands the ~/.claude/ tree
Then "agents/" appears dimmed with descriptive tooltip
And clicking the dimmed entry shows what agents are and links to documentation

#### Scenario: Malformed file shown with error badge
Given .claude/settings.json contains invalid JSON
When Kenji views the Atlas
Then settings.json displays with a red error badge
And the content preview shows the parse error location
And all other files display normally

### Acceptance Criteria
- [ ] Dual-pane tree shows ~/.claude/ and .claude/ with scope coloring (blue=user, green=project)
- [ ] Subsystem icons distinguish file types (rules, skills, agents, settings, memory, hooks, MCP)
- [ ] Content preview pane shows file contents with syntax highlighting
- [ ] YAML frontmatter annotations displayed for rules, skills, and agents
- [ ] Missing/empty directories shown dimmed with descriptive tooltips
- [ ] Malformed files display error badge with parse error details
- [ ] Other files unaffected by malformed file errors

### Technical Notes
- Tree component must support recursive directory expansion
- Content preview handles JSON (syntax highlight), Markdown (rendered or raw with YAML frontmatter), and plain text
- Missing file indicators based on known .claude ecosystem directory structure
- Cross-platform path handling: `os.homedir()` for `~/.claude/`
- Dependency: FR-01 (config parser)

### Job Traces
- JS-01 (Understand overall config structure)
- JS-07 (Discover available config options)
- O-01 (14), O-04 (17)

---

## US-CE-03: Configuration Relationship Graph

### Problem
Sofia Hernandez is a framework developer building nwave-ai with 10 skills, 5 agents, a plugin, custom hooks, and 3 MCP servers. She finds it impossible to hold the full web of cross-references in her head -- which agents use which skills, what the plugin contributes, which hooks fire from where. She currently maintains a spreadsheet (created over ~20 hours) and a README configuration map (~1 hour/week maintenance) to track these relationships. When something changes, the spreadsheet and README go stale.

### Who
- Framework developer | Complex multi-subsystem config | Wants to see all relationships visually

### Solution
An interactive force-directed graph showing all configuration elements as nodes (shaped by type, colored by scope) with edges representing cross-references (agent->skill, plugin->component, rule->path).

### Domain Examples

#### 1: Trace Agent Skills (Happy Path)
Sofia opens the Galaxy and clicks her "solution-architect" agent node (green hexagon). Three edges highlight connecting to skill nodes: "api-patterns" (green circle, project), "code-review" (blue circle, user scope), and "nw-plugin:formatting" (purple circle, plugin scope). The detail panel shows "Agent: solution-architect | Scope: Project | Skills: 3 | Model: sonnet."

#### 2: Plugin Explosion (High-Delight Interaction)
Sofia clicks the "nw-plugin" star node. It expands to reveal 7 child nodes: 3 skills (namespaced as nw-plugin:format, nw-plugin:lint, nw-plugin:deploy), 2 agents, 1 hook, 1 MCP server. She can see the full plugin inventory at a glance.

#### 3: Naming Conflict Detection (Error/Boundary)
Sofia's plugin provides an agent named "code-reviewer." Her project also has `.claude/agents/code-reviewer.md`. The Galaxy shows a red edge between the two nodes with tooltip: "Naming conflict: project scope wins. .claude/agents/code-reviewer.md overrides nw-plugin agent." Sofia realizes she needs to rename her plugin's agent.

### UAT Scenarios (BDD)

#### Scenario: Sofia traces agent-to-skill relationships
Given Sofia Hernandez has an agent "solution-architect" with skills: ["api-patterns", "code-review", "nw-plugin:formatting"]
When Sofia opens the Galaxy view and clicks the "solution-architect" node
Then 3 edges highlight connecting to the referenced skill nodes
And each skill node shows its scope color (project=green, user=blue, plugin=purple)
And the detail panel shows agent name, scope, skills list, and model

#### Scenario: Sofia filters the graph by subsystem
Given Sofia's config has 46 elements across all subsystems
When Sofia selects the "Agents+Skills" filter
Then only agent and skill nodes are visible with their connecting edges
And all other node types (rules, hooks, MCP, settings) are hidden

#### Scenario: Sofia expands a plugin to see its components
Given plugin "nw-plugin" contains 3 skills, 2 agents, 1 hook, 1 MCP server
When Sofia clicks the "nw-plugin" star node
Then the plugin expands revealing 7 child nodes arranged around it
And skill names show namespace prefix (nw-plugin:format, nw-plugin:lint, nw-plugin:deploy)

#### Scenario: Naming conflict highlighted between plugin and project
Given plugin "nw-plugin" and project both have agent named "code-reviewer"
When Sofia views the Galaxy with plugin expanded
Then a red edge connects the two "code-reviewer" nodes
And the tooltip reads "Naming conflict: project scope wins"

### Acceptance Criteria
- [ ] Nodes shaped by type (hexagon=agent, circle=skill, square=rule, diamond=hook, pentagon=MCP, star=plugin)
- [ ] Nodes colored by scope (user=blue, project=green, local=yellow, plugin=purple, managed=red)
- [ ] Edges represent actual cross-references from YAML frontmatter (skills:, tools:, hooks:)
- [ ] Subsystem filtering hides/shows node types
- [ ] Plugin explosion expands star node to reveal contained components
- [ ] Naming conflicts shown with red edges and explanatory tooltip
- [ ] Detail panel shows name, scope, type, relationships, and file excerpt on node click
- [ ] Graph handles 50+ nodes without performance degradation

### Technical Notes
- D3.js force simulation (already in Norbert tech stack)
- Cross-references extracted from YAML frontmatter: agent `skills:` field, plugin manifest, agent `hooks:` field
- Performance: test with 100+ nodes, use canvas rendering if SVG is too slow
- Plugin namespacing: skills prefixed, agents not prefixed
- Dependency: FR-01 (config parser with cross-reference extraction)

### Job Traces
- JS-03 (Explore config relationships)
- JS-05 (Verify plugin contributions)
- O-16 (17), O-15 (16), O-10 (15)

---

## US-CE-04: Path Rule Tester

### Problem
Mei-Lin Chen is a developer who uses path-scoped rules extensively to apply different coding conventions to different parts of her monorepo. She finds it infuriating that path-scoped rules fail silently -- a wrong glob pattern means the rule simply never loads, with no error, no log, and no indication. She spent 20 minutes debugging a single glob pattern mismatch and now avoids complex patterns because she cannot verify they work.

### Who
- Developer authoring path-scoped rules | Monorepo with varied conventions | Wants confidence that rules apply to intended files

### Solution
A diagnostic tool where the user enters a file path and sees which rules match (with the matching pattern) and which do not (with the specific reason for the mismatch).

### Domain Examples

#### 1: Test API File Against All Rules (Happy Path)
Mei-Lin enters `src/api/routes/users.ts` in the Path Rule Tester. Results show: `api.md` MATCH (pattern `src/api/**/*.ts`), `typescript.md` MATCH (pattern `**/*.ts`), `preferences.md` MATCH (unconditional -- no paths frontmatter). `testing.md` NO MATCH (pattern `**/*.test.ts` -- "users.ts" does not end with ".test.ts"). `architecture.md` NO MATCH (pattern `docs/**/*.md` -- "src/api/" is not under "docs/").

#### 2: All Rules Match (Edge Case)
Mei-Lin enters `src/api/routes/users.test.ts`. Both `api.md` (matches `src/api/**/*.ts`) and `testing.md` (matches `**/*.test.ts`) show MATCH, plus all unconditional rules. Mei-Lin sees that test files in the API directory get both API conventions and testing rules applied.

#### 3: No Path-Scoped Rules Exist (Boundary)
A newcomer's project has only unconditional rules (no `paths:` frontmatter on any rule). Entering any file path shows all rules as MATCH with note "No path-scoped rules configured. All rules apply unconditionally."

### UAT Scenarios (BDD)

#### Scenario: Mei-Lin tests a file path against path-scoped rules
Given Mei-Lin Chen's project has rules with paths frontmatter:
  | Rule            | Pattern          |
  | api.md          | src/api/**/*.ts  |
  | testing.md      | **/*.test.ts     |
  | typescript.md   | **/*.ts          |
  | architecture.md | docs/**/*.md     |
  | preferences.md  | (unconditional)  |
When Mei-Lin enters "src/api/routes/users.ts" in the Path Rule Tester
Then results show:
  | Rule            | Status   | Reason                                 |
  | api.md          | MATCH    | Pattern src/api/**/*.ts matches        |
  | typescript.md   | MATCH    | Pattern **/*.ts matches                |
  | preferences.md  | MATCH    | Unconditional (no paths restriction)   |
  | testing.md      | NO MATCH | "users.ts" does not end with ".test.ts" |
  | architecture.md | NO MATCH | "src/api/" is not under "docs/"        |

#### Scenario: Mei-Lin navigates from tester to rule file
Given the Path Tester shows api.md as MATCH
When Mei-Lin clicks "View file" on the api.md result
Then Config Explorer navigates to Atlas with api.md selected and content visible

#### Scenario: Path Tester with no path-scoped rules
Given only unconditional rules exist (no paths: frontmatter)
When a user enters any file path
Then all rules show as MATCH
And a message reads "No path-scoped rules configured. All rules apply unconditionally."

### Acceptance Criteria
- [ ] Text input accepts a file path (relative to project root)
- [ ] Results show MATCH and NO MATCH for every rule across all scopes (user + project)
- [ ] Matching rules display the matched pattern
- [ ] Non-matching rules display specific mismatch reason
- [ ] Unconditional rules (no paths: frontmatter) always show as MATCH
- [ ] Click-through navigates to rule file in Atlas
- [ ] Glob matching uses picomatch-compatible semantics

### Technical Notes
- Glob matching library must be picomatch or equivalent (same ecosystem as Claude Code)
- Patterns from YAML frontmatter `paths:` field, supporting: `**/*.ts`, `*.{ts,tsx}`, negation
- Mismatch reasons require comparing path segments against pattern segments
- Dependency: FR-01 (config parser extracting paths: frontmatter from rules)

### Job Traces
- JS-04 (Debug path-scoped rule loading)
- O-08 (17), O-09 (15), O-14 (15)

---

## US-CE-05: Configuration Mind Map Overview

### Problem
Kenji Tanaka (newcomer) and Sofia Hernandez (expert) both need a structural overview of the configuration ecosystem, but at different levels of detail. The mind map provides the "30,000-foot view" -- 8 subsystem branches with element counts -- that orients newcomers and gives experts a quick inventory. Without this, users must mentally compile the structure from directory listings.

### Who
- All users | Need quick structural overview | Want to see subsystem taxonomy at a glance

### Solution
A hierarchical mind map centered on the project with 8 primary branches (one per subsystem), element counts, scope coloring, and expand/collapse interaction.

### Domain Examples

#### 1: Newcomer Sees Configuration Taxonomy (Happy Path)
Kenji opens the Mind Map and immediately sees 8 branches: Memory (3), Settings (2), Rules (6), Skills (2), Agents (2), Hooks (4), Plugins (1), MCP (1). He clicks to expand "Skills" and sees 2 skill entries: api-patterns (project, green) and testing (project, green). He now understands the structure without reading documentation.

#### 2: Expert Gets Quick Inventory (Happy Path)
Sofia opens the Mind Map and sees branches with high counts: Rules (8), Skills (10), Agents (5), Hooks (12). She collapses branches she does not need and focuses on Hooks (12) to understand the hook distribution. She sees hooks from 3 scopes: user (2), project (5), plugin (5).

#### 3: Empty Configuration (Boundary)
A newcomer with only `CLAUDE.md` and `settings.json` opens the Mind Map. Memory (2) and Settings (1) have entries. All other branches show (0) and are dimmed, indicating available but unconfigured subsystems.

### UAT Scenarios (BDD)

#### Scenario: Kenji views the mind map with 8 subsystem branches
Given Kenji's project has configuration across 7 subsystems
When Kenji opens the Mind Map view
Then 8 primary branches are displayed: Memory, Settings, Rules, Skills, Agents, Hooks, Plugins, MCP
And each branch shows element count with scope breakdown

#### Scenario: Sofia collapses and expands branches for focused viewing
Given the Mind Map shows all 8 branches
When Sofia collapses the "Rules" branch
Then only the summary "Rules (8)" is visible
And expanding it again reveals individual rule nodes

#### Scenario: Mind map for minimal configuration
Given a newcomer has only CLAUDE.md and settings.json
When the Mind Map loads
Then Memory (2) and Settings (1) branches have entries
And remaining branches show (0) dimmed

### Acceptance Criteria
- [ ] 8 primary branches displayed (Memory, Settings, Rules, Skills, Agents, Hooks, Plugins, MCP)
- [ ] Element counts accurate per branch and match Atlas/landing page totals
- [ ] Scope coloring consistent with all other views
- [ ] Branches expand to show individual elements, collapse to show counts
- [ ] Empty subsystems shown dimmed with zero count

### Technical Notes
- D3.js tree layout (horizontal or radial)
- Cross-links (dotted lines) between related elements across subsystems shown optionally
- Dependency: FR-01 (config parser with subsystem classification)

### Job Traces
- JS-01, JS-07
- O-01 (14), O-02 (12)

---

## US-CE-06: Configuration Search

### Problem
Sofia Hernandez knows she defined a `PreToolUse` hook somewhere in her configuration but cannot remember which of the 3 possible locations it is in. She currently runs `grep -r "PreToolUse" ~/.claude/ .claude/` across multiple directories, which requires knowing all the paths and handling different file formats. She wants a single search that covers everything.

### Who
- Any user | Knows what to find, not where | Wants unified search across all config

### Solution
Full-text search across all configuration files with results showing file path, scope badge, subsystem icon, and matching line.

### Domain Examples

#### 1: Search for Hook Event Name (Happy Path)
Sofia opens Search (Cmd+K) and types "PreToolUse." Results show 3 matches: `.claude/settings.json` (Project, Hooks), `.claude/settings.local.json` (Local, Hooks), `nw-plugin/hooks/hooks.json` (Plugin, Hooks). She clicks the first result and navigates to that file in Atlas.

#### 2: Search for a Setting Key (Happy Path)
Ravi searches for "permissions" and finds matches in `~/.claude/settings.json` (User, Settings) and `.claude/settings.json` (Project, Settings). He navigates to the Cascade to see which permissions are effective.

#### 3: No Results (Boundary)
Kenji searches for "kubernetes" and sees "No configuration files contain 'kubernetes'. Try searching for a setting name, rule keyword, or skill name."

### UAT Scenarios (BDD)

#### Scenario: Sofia searches for hooks across all scopes
Given hooks are defined in 3 files across 3 scopes
When Sofia opens Search and enters "PreToolUse"
Then 3 results display with scope badges and subsystem icons
And clicking a result navigates to the file in Atlas

#### Scenario: Search returns no results with guidance
Given no configuration files contain the term "kubernetes"
When a user searches for "kubernetes"
Then a message reads "No configuration files contain 'kubernetes'"
And a suggestion reads "Try searching for a setting name, rule keyword, or skill name"

#### Scenario: Search accessible via keyboard shortcut
Given the user is on any Config Explorer view
When the user presses Cmd+K (or Ctrl+K on Windows/Linux)
Then the search input focuses and accepts queries

### Acceptance Criteria
- [ ] Single search input searches across all configuration files in all scopes
- [ ] Results show file path, scope badge (colored), subsystem icon, and matching line
- [ ] Click result navigates to file in Atlas with matching line highlighted
- [ ] No-results state shows helpful guidance message
- [ ] Cmd+K (Ctrl+K) keyboard shortcut opens search from any view
- [ ] Search completes within 500ms for typical configurations

### Technical Notes
- Full-text index built during config parser scan
- Index covers JSON, Markdown, and YAML frontmatter content
- Cross-platform keyboard shortcut handling (Cmd vs. Ctrl)
- Dependency: FR-01 (config parser)

### Job Traces
- JS-08 (Search across all configuration)
- O-03 (13)

---

## US-CE-07: Walking Skeleton -- Settings Parser and Tree View

### Problem
Before building the full Config Explorer, the team needs to validate the end-to-end data pipeline: filesystem reading, JSON parsing, API serving, and Svelte rendering with scope coloring. This walking skeleton proves the architecture works before investing in the more complex parsers and visualizations.

### Who
- Development team | Need architectural validation | Want fast feedback on feasibility

### Solution
Parse `settings.json` from user and project scopes, serve via a new Fastify API endpoint, render in a minimal tree component with scope coloring.

### Domain Examples

#### 1: Two-Scope Settings Display (Happy Path)
The walking skeleton reads `~/.claude/settings.json` (user scope) and `.claude/settings.json` (project scope). The API returns both with scope annotations. The Svelte component renders a tree: user settings in blue, project settings in green.

#### 2: Missing User Settings (Boundary)
`~/.claude/settings.json` does not exist. The API returns only the project settings. The tree shows `.claude/settings.json` (project, green) and a placeholder for user settings: "~/.claude/settings.json not found."

#### 3: Invalid JSON (Error)
`.claude/settings.json` has a syntax error. The API returns a parse error for that file. The tree shows the file with an error badge. User settings display normally.

### UAT Scenarios (BDD)

#### Scenario: Walking skeleton renders two-scope settings
Given ~/.claude/settings.json contains {"model": "sonnet"}
And .claude/settings.json contains {"permissions": {"allow": ["Read"]}}
When the Config Explorer API endpoint is called
Then the response includes both files with scope annotations
And the Svelte tree renders user settings in blue and project settings in green

#### Scenario: Missing settings file handled gracefully
Given ~/.claude/settings.json does not exist
When the Config Explorer API endpoint is called
Then the response includes only project settings
And the tree shows a placeholder for the missing user settings file

#### Scenario: Invalid JSON in settings file
Given .claude/settings.json contains invalid JSON
When the Config Explorer API endpoint is called
Then the response includes a parse error for that file
And the tree shows the file with an error badge

### Acceptance Criteria
- [ ] API endpoint serves parsed settings.json from both scopes with scope annotations
- [ ] Svelte tree component renders settings with scope coloring (blue=user, green=project)
- [ ] Missing files handled with placeholder (not error)
- [ ] Invalid JSON produces error badge with parse error details
- [ ] End-to-end pipeline validates: filesystem -> parser -> API -> UI

### Technical Notes
- This is a spike/walking skeleton -- validates architecture, not full feature set
- Effort: ~1 day
- Creates the foundation for all subsequent Config Explorer stories
- New Fastify route: `GET /api/config/settings`
- New Svelte component: `ConfigTree.svelte` (minimal, expanded in US-CE-02)

### Job Traces
- Enables all jobs (JS-01 through JS-08) by validating the architecture

---

## Story Priority Summary

| Priority | Story | Effort | Jobs Served | Key Outcome Scores |
|----------|-------|--------|-------------|-------------------|
| **P0 (First)** | US-CE-07: Walking Skeleton | ~1 day | All (architecture) | Enables all |
| **P1 (Must)** | US-CE-01: Cascade Waterfall | ~2-3 days | JS-02 | O-07(17), O-08(17), O-11(17), O-12(17) |
| **P1 (Must)** | US-CE-02: Atlas Tree | ~2 days | JS-01, JS-07 | O-04(17), O-01(14) |
| **P1 (Must)** | US-CE-04: Path Rule Tester | ~1-2 days | JS-04 | O-08(17), O-09(15) |
| **P2 (Should)** | US-CE-05: Mind Map | ~2 days | JS-01, JS-07 | O-01(14), O-02(12) |
| **P2 (Should)** | US-CE-03: Galaxy Graph | ~3 days | JS-03, JS-05 | O-16(17), O-10(15) |
| **P2 (Should)** | US-CE-06: Search | ~1-2 days | JS-08 | O-03(13) |
