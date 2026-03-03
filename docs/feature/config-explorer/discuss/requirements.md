# Requirements: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 4 (Requirements Crafting)
**Date**: 2026-03-03
**Source**: JTBD analysis (Phase 1), Journey design (Phase 2), Coherence validation (Phase 3)

---

## Business Context

Config Explorer extends the Norbert dashboard from a runtime observatory to a configuration observatory. It provides visual navigation, relationship mapping, and precedence debugging for the Claude Code `.claude` configuration ecosystem -- 7 subsystems, 5 scopes, 30+ file locations.

### Strategic Positioning
- **For Norbert**: Stickiness amplifier. Creates "between sessions" usage pattern. Broadens audience beyond multi-agent users to anyone with complex config.
- **Differentiation**: Zero tools exist for visualizing Claude Code configuration relationships or precedence resolution. First mover in this space.
- **Revenue**: Indirect -- increases Norbert's value proposition, drives broader adoption, enables Pro tier features (team audit, config diff over time).

---

## Personas

### Kenji Tanaka -- The Newcomer
Mid-level developer, joined project 2 weeks ago. Has a basic CLAUDE.md and settings.json. Aware that more config options exist but overwhelmed by documentation. Needs a visual map to understand the system and discover available features.

### Ravi Patel -- The Debugger
Senior developer managing a monorepo with 5 CLAUDE.md files, path-scoped rules, and hooks in 3 locations. Regularly spends 20-60 minutes debugging configuration issues. Needs precedence visibility to stop guessing.

### Sofia Hernandez -- The Framework Developer
Builds multi-agent orchestration with 10 skills, 5 agents, a plugin, custom hooks, and 3 MCP servers. Maintains spreadsheets tracking agent-skill relationships. Needs a visual graph to replace manual tracking.

### Mei-Lin Chen -- The Rule Author
Developer using path-scoped rules extensively. Has been burned by silent glob pattern failures. Avoids complex patterns because she cannot verify they work. Needs a pattern tester.

### Carlos Rivera -- The Plugin Author
Develops plugins for distribution. Cannot verify what consumers see after installation. Gets support requests he cannot diagnose remotely. Needs plugin visibility and conflict detection.

---

## Functional Requirements

### FR-01: Configuration File Discovery and Parsing
The system discovers and parses all configuration files across all scopes:
- **User scope**: `~/.claude/` (settings, CLAUDE.md, rules, skills, agents, MCP config)
- **Project scope**: `.claude/` (settings, CLAUDE.md, rules, skills, agents, hooks, MCP config) and root `CLAUDE.md`, `CLAUDE.local.md`, `.mcp.json`
- **Local scope**: `*.local.*` files (settings.local.json, CLAUDE.local.md)
- **Plugin scope**: Installed plugins in `~/.claude/plugins/cache/`
- **Managed scope**: Platform-specific managed settings path (graceful degradation if not readable)

File formats parsed: JSON (settings, MCP, plugins), Markdown with YAML frontmatter (rules, skills, agents), plain Markdown (CLAUDE.md).

### FR-02: Config Atlas (Anatomy View)
Navigable dual-pane tree of `~/.claude/` and `.claude/` directories with:
- Scope coloring on every tree item
- Subsystem icons (rules, skills, agents, etc.)
- Content preview pane with syntax highlighting and frontmatter annotations
- Missing file indicators for expected but unconfigured directories
- Click-through navigation to Cascade, Galaxy, and Path Rule Tester

### FR-03: Config Mind (Mind Map)
Hierarchical mind map centered on the project with:
- 8 primary branches (Memory, Settings, Rules, Skills, Agents, Hooks, Plugins, MCP)
- Element counts per branch with scope breakdown
- Expand/collapse branches
- Consistent scope coloring
- Cross-links (dotted lines) for cross-subsystem relationships
- Default overview visualization for newcomers

### FR-04: Config Galaxy (Relationship Graph)
Force-directed graph showing cross-references between configuration elements:
- Nodes shaped by type (hexagon=agent, circle=skill, square=rule, diamond=hook, pentagon=MCP, rectangle=CLAUDE.md, star=plugin)
- Edges representing relationships (agent->skill, plugin->component, rule->path)
- Scope coloring on nodes
- Subsystem filtering (show only agents+skills, only hooks, etc.)
- Plugin explosion (click plugin to expand its components)
- Naming conflict detection (red edges between conflicting names)
- Detail panel on node click (name, scope, type, relationships, file content)

### FR-05: Config Cascade (Precedence Waterfall)
Per-subsystem precedence resolution display:
- Subsystem selector (settings, CLAUDE.md, rules, skills, agents, hooks, MCP)
- Waterfall from managed (top) to user (bottom) showing each scope's contribution
- ACTIVE marker on the effective/winning value
- OVERRIDDEN marker (with strikethrough) on suppressed values
- Override reason ("Overridden by LOCAL scope")
- Array merge visualization for settings that concatenate (permissions)
- On-demand item labeling ("Loaded at runtime" for subdirectory CLAUDE.md, path-scoped rules)
- Click-through to Atlas for file details

### FR-06: Path Rule Tester
Diagnostic tool for testing glob pattern matching:
- Text input for file path
- Results showing all rules with MATCH or NO MATCH status
- For matching rules: pattern displayed with confirmation
- For non-matching rules: specific reason why the pattern does not match
- Unconditional rules (no `paths:` frontmatter) always shown as MATCH
- Click-through to Atlas for rule file details
- Glob matching uses same semantics as Claude Code (picomatch-compatible)

### FR-07: Configuration Search
Full-text search across all configuration files:
- Single search input (accessible via Cmd+K shortcut)
- Results show file path, scope badge (colored), subsystem icon, matching line with context
- Click result to navigate to Atlas with file selected and matching line highlighted
- Handles all file formats (JSON, Markdown, YAML frontmatter)

### FR-08: View-to-View Navigation
Seamless navigation between all views:
- Tab bar with 4 primary views + 2 utilities always visible
- Click-through from any node/file to relevant view (Atlas->Cascade, Galaxy->Atlas, Search->Atlas)
- Breadcrumb showing current location: Config Explorer > View > Selected Element
- Context preserved during navigation (selected subsystem, filter state)

### FR-09: API Endpoints
New Fastify API endpoints serving parsed configuration data:
- `GET /api/config` -- Full configuration model (nodes, edges, scopes, precedence)
- `GET /api/config/tree` -- File tree structure for Atlas
- `GET /api/config/precedence/:subsystem` -- Precedence chain for Cascade
- `GET /api/config/search?q=` -- Search results
- `GET /api/config/test-path?path=` -- Path rule matching results
- WebSocket updates when filesystem changes (optional, v2 candidate)

---

## Non-Functional Requirements

### NFR-01: Performance
- Config parser completes scanning within 2 seconds for typical configurations (50 files)
- Galaxy graph renders within 2 seconds for up to 100 nodes
- All view transitions complete within 200ms
- Search returns results within 500ms

### NFR-02: Cross-Platform Compatibility
- `~/.claude/` resolves correctly on macOS, Linux, and Windows (`os.homedir()`)
- Managed settings paths handle platform-specific locations
- File path separators normalized for display
- Line ending handling (LF/CRLF) for file content parsing

### NFR-03: Graceful Degradation
- Managed settings inaccessible (permissions) -> other scopes display normally
- Malformed configuration file -> error badge on affected file, other files display normally
- Plugin directory structure unexpected -> best-effort parsing with warning
- Empty .claude/ directory -> show available subsystems as unconfigured

### NFR-04: Accessibility (WCAG 2.2 AA)
- Scope colors have sufficient contrast (4.5:1 ratio)
- Graph nodes accessible via keyboard navigation
- Screen reader support for tree views and search results
- Focus indicators visible on all interactive elements
- Color not the sole differentiator (scope labels accompany colors)

### NFR-05: Local-First
- All data stays on localhost (Norbert constraint)
- No external network requests from Config Explorer
- Configuration files read from local filesystem only
- No data sent to Anthropic or any external service

---

## Business Rules

### BR-01: Precedence Resolution Order
Settings: managed > CLI args > local > project > user.
CLAUDE.md: managed > local override > project > subdirectory (on-demand) > user. CLAUDE.md files accumulate (additive), not override.
Rules: project rules > user rules (by scope). Path-scoped rules loaded on-demand when matching files are read.
Skills: enterprise > personal > project > plugin.
Agents: CLI flag > project > user > plugin. Name collision: higher scope wins.
Array settings (permissions): merge (concatenate + deduplicate) across scopes.

### BR-02: Plugin Namespacing
Plugin skills are namespaced as `plugin-name:skill-name`. Plugin agents are NOT namespaced. Name collisions between plugin agents and user/project agents resolved by precedence (project > user > plugin).

### BR-03: Read-Only Behavior
Config Explorer is an observer. It reads configuration files but never modifies them. No edit, create, or delete operations on configuration files.

### BR-04: On-Demand Item Labeling
Subdirectory CLAUDE.md files and path-scoped rules are loaded on-demand at runtime by Claude Code. Config Explorer discovers them via filesystem scan but labels them as "Loaded on-demand at runtime" to distinguish from always-loaded configuration.

---

## Walking Skeleton Evaluation

### Recommendation: Yes -- walking skeleton is appropriate

Norbert already has the infrastructure (Fastify server, Svelte dashboard, D3.js, SQLite). Config Explorer adds a new data pipeline (filesystem -> parser -> API -> UI) that can be validated with a thin vertical slice.

### Proposed Walking Skeleton

**Scope**: Parse `settings.json` from user and project scopes, serve via API, render in a basic tree view.

| Layer | Implementation |
|-------|---------------|
| **Parse** | Read `~/.claude/settings.json` and `.claude/settings.json`. Parse JSON. Annotate with scope. |
| **Serve** | `GET /api/config/settings` returns parsed settings with scope annotations |
| **Render** | Svelte tree component displaying two-scope settings with scope coloring |

**Validates**:
- Filesystem access from Norbert server process works cross-platform
- JSON parsing and scope annotation logic is correct
- Fastify API endpoint can serve configuration data
- Svelte component can render a config tree with scope coloring
- End-to-end data flow: filesystem -> parser -> API -> WebSocket -> UI

**Does Not Validate** (deferred to subsequent stories):
- YAML frontmatter parsing (rules, skills, agents)
- Cross-reference extraction
- Force-directed graph rendering
- Precedence resolution beyond simple settings

**Effort**: ~1 day for walking skeleton

---

## Story Map

```
Workflow:  [Parse Config] --> [Serve via API] --> [Render Atlas] --> [Add Views] --> [Add Utilities]
             |                   |                   |                 |                |
Row 1:     Parse JSON          GET /api/config      Tree view       Cascade          Path Tester
(MVP)      (settings)          /tree endpoint       Scope colors    Waterfall        Glob match
           Parse Markdown      /precedence ep       Content prev    Subsystem sel    Match/no-match
           Parse YAML fm       /search ep           Missing files   Active/override  Reasons
             |                   |                   |                 |                |
Row 2:     Cross-ref           /test-path ep        Click-through   Array merge      Search
(Phase 2)  extraction          WebSocket updates    Navigation      On-demand label  Full-text index
           Conflict detect     File watcher         Breadcrumb      Conflict show    Cmd+K shortcut
             |                                       |                 |
Row 3:     Plugin parsing                          Mind Map         Galaxy
(Phase 2)  Managed settings                        8 branches       Force graph
                                                   Collapse/expand  Plugin explosion
                                                                    Subsystem filter
```

Row 1 = MVP (US-CE-01 through US-CE-04). Row 2 = Must Have completion. Row 3 = Should Have.

---

## Risk Assessment

| Risk | Category | Probability | Impact | Mitigation |
|------|----------|-------------|--------|------------|
| Precedence resolution inaccuracy | Technical | Medium | High | Pure function with comprehensive tests against documented rules. Label edge cases. |
| Glob matching differs from Claude Code | Technical | Medium | High | Use picomatch (same library ecosystem). Document any known differences. |
| D3.js graph performance for large configs | Technical | Low | Medium | Subsystem filtering. Test with 100+ nodes. Lazy rendering. |
| Anthropic changes config file formats | Business | Low | High | Monitor Anthropic releases. Parser designed with format adapters for extensibility. |
| Managed settings require admin permissions | Technical | Medium | Low | Graceful degradation. Show "access denied" message. All other scopes work. |
| Config Explorer scope creep (team features, linting) | Project | Medium | Medium | Strict v1 scope: Atlas, Cascade, Galaxy, Path Tester, Search, Mind Map. Team audit and linting deferred to v2+. |
