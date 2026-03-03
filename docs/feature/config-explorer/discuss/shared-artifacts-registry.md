# Shared Artifacts Registry: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 3 (Coherence Validation)
**Date**: 2026-03-03

---

## Registry

### config_summary

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser scan output: filesystem discovery of `~/.claude/` and `.claude/` |
| **Consumers** | Landing page summary, Mind Map total count, Atlas tree node counts |
| **Owner** | Config parser module (server-side) |
| **Integration Risk** | MEDIUM -- counts must be consistent across landing page, mind map, and atlas. If parser caches results, stale counts after filesystem changes are possible. |
| **Validation** | Sum of files in Atlas tree equals count on landing page. Mind map branch counts sum to total. |

### scope_colors

| Property | Value |
|----------|-------|
| **Source of Truth** | Design system constant (Svelte theme or CSS custom properties) |
| **Values** | user=blue (#3B82F6), project=green (#22C55E), local=yellow (#EAB308), plugin=purple (#A855F7), managed=red (#EF4444) |
| **Consumers** | Atlas tree item colors, Mind Map node colors, Galaxy node colors, Cascade scope headers, Scope legend, Search result badges |
| **Owner** | Dashboard design system (`@norbert/dashboard`) |
| **Integration Risk** | HIGH -- scope coloring is the primary comprehension mechanism (Phase 3 testing). Inconsistency between views destroys trust in the visualization. |
| **Validation** | Visual regression test: same element appears with same color in Atlas, Mind Map, Galaxy, and Cascade. Single CSS custom property definition consumed by all views. |

### subsystem_classification

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: file-to-subsystem mapping based on path patterns |
| **Values** | memory, settings, rules, skills, agents, hooks, plugins, mcp |
| **Consumers** | Mind Map branch names, Galaxy subsystem filter, Atlas subsystem icons, Cascade subsystem selector, Search result subsystem badges |
| **Owner** | Config parser module (pure function mapping filepath to subsystem) |
| **Integration Risk** | HIGH -- subsystem classification must be identical across all views. If Mind Map says "6 rules" but Atlas shows 5 rule files, user trust is broken. |
| **Validation** | Unit test: given a set of file paths, parser produces identical subsystem classification consumed by all views. No view applies its own classification logic. |

### file_tree

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: recursive directory listing of `~/.claude/` and `.claude/` with scope annotations |
| **Consumers** | Atlas tree pane, Mind Map drill-down, Search result file paths, Cascade file references |
| **Owner** | Config parser module |
| **Integration Risk** | MEDIUM -- file paths used in Atlas must match paths referenced in Cascade and Search. Relative vs. absolute path handling must be consistent. |
| **Validation** | Clicking a file reference in Cascade navigates to the same file in Atlas. Search results link to correct Atlas entries. |

### file_content

| Property | Value |
|----------|-------|
| **Source of Truth** | Filesystem: raw file content, parsed by format (JSON, Markdown, YAML frontmatter) |
| **Consumers** | Atlas content preview, Cascade file content display, Galaxy node detail panel |
| **Owner** | Config parser (parsing), Dashboard (rendering) |
| **Integration Risk** | MEDIUM -- parsed content shown in Atlas must match content in Cascade and Galaxy detail. Parsing must handle encoding (UTF-8), line endings (LF/CRLF cross-platform), and malformed files gracefully. |
| **Validation** | Same file content displayed identically in Atlas preview, Cascade detail, and Galaxy panel. Malformed files show consistent error message across views. |

### precedence_chain

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: precedence resolution per subsystem following documented order |
| **Resolution Order** | Settings: managed > CLI args > local > project > user. CLAUDE.md: managed > local > project > subdirectory (on-demand) > user. Rules: project > user. Skills: enterprise > personal > project > plugin. Agents: CLI > project > user > plugin. |
| **Consumers** | Cascade waterfall view, Galaxy node detail (abbreviated precedence), Atlas file annotations |
| **Owner** | Config parser module (precedence resolution pure function) |
| **Integration Risk** | HIGH -- incorrect precedence resolution is the highest-value bug. The cascade waterfall IS the answer to "what is active?" If it is wrong, Config Explorer's core value proposition fails. |
| **Validation** | Test against documented precedence rules from Research Finding 12. Test edge cases: both `./CLAUDE.md` and `./.claude/CLAUDE.md` exist, `claudeMdExcludes` present, array merge for permissions. |

### effective_value

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: resolved "winner" at each precedence level, derived from precedence_chain |
| **Consumers** | Cascade ACTIVE marker, Atlas file highlighting (if file is the winner) |
| **Owner** | Config parser module |
| **Integration Risk** | MEDIUM -- effective value must be consistent between Cascade ACTIVE marker and Atlas highlighting. |
| **Validation** | File marked ACTIVE in Cascade is the same file highlighted in Atlas when navigating. |

### relationship_edges

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: cross-references extracted from YAML frontmatter fields (`skills:`, `tools:`, `paths:`, `mcpServers:`, `hooks:`) |
| **Edge Types** | agent-references-skill, plugin-contains-component, agent-defines-hook, rule-scoped-to-path, skill-allows-tool |
| **Consumers** | Galaxy graph edges, Mind Map cross-links (dotted lines), Plugin contribution viewer |
| **Owner** | Config parser module (cross-reference extraction pure function) |
| **Integration Risk** | HIGH -- if the parser misses a cross-reference (e.g., agent's `skills:` field not parsed), the graph shows incomplete relationships. Users comparing graph to their actual files will lose trust. |
| **Validation** | Test: parse known agent files with `skills:` field, verify edges are created. Parse plugin manifest, verify all component nodes created. Compare edge count to manual audit of cross-references. |

### naming_conflicts

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: name collision detection comparing element names across scopes |
| **Consumers** | Galaxy conflict indicators (red edges), Plugin contribution viewer conflict section |
| **Owner** | Config parser module |
| **Integration Risk** | MEDIUM -- false positives (flagging non-conflicting names) are annoying. False negatives (missing real conflicts) are dangerous. Plugin skills are namespaced (`plugin:skill`), agents are NOT namespaced. |
| **Validation** | Test: same agent name at project and plugin scopes detected. Different agent names not flagged. Namespaced plugin skills not flagged against non-namespaced project skills. |

### rule_glob_patterns

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: `paths:` YAML frontmatter from all rule files |
| **Consumers** | Path Rule Tester match results, Atlas rule frontmatter annotation, Cascade rule scope indicators |
| **Owner** | Config parser module |
| **Integration Risk** | HIGH -- glob matching must use same semantics as Claude Code. Different glob library = different matching behavior = wrong results. |
| **Validation** | Test with known Claude Code glob patterns from Research Finding 5: `**/*.ts`, `src/**/*`, `*.{ts,tsx}`. Verify match/no-match results align with expected Claude Code behavior. |

### missing_files

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: expected directories/files not found on disk, based on known .claude ecosystem structure |
| **Expected Directories** | `~/.claude/agents/`, `~/.claude/skills/`, `~/.claude/rules/`, `.claude/agents/`, `.claude/skills/`, `.claude/rules/`, `.claude/hooks/` |
| **Consumers** | Atlas tree (dimmed entries), Mind Map (empty branches with zero count) |
| **Owner** | Config parser module |
| **Integration Risk** | LOW -- missing file indicators are informational. Wrong indicator (showing "missing" when directory exists but is empty) would be confusing but not dangerous. |
| **Validation** | Test: directory does not exist -> shown as missing. Directory exists but is empty -> shown as empty (different from missing). Directory has files -> not shown as missing. |

### search_index

| Property | Value |
|----------|-------|
| **Source of Truth** | Config parser: full-text index of all configuration file contents |
| **Consumers** | Search results list, Navigation to Atlas/Galaxy/Cascade from search results |
| **Owner** | Config parser module (indexing), Dashboard (search UI) |
| **Integration Risk** | MEDIUM -- search results must link to correct files in Atlas. If search index uses different file paths than Atlas tree, navigation breaks. |
| **Validation** | Search for known string, click result, verify Atlas navigates to correct file with correct content visible. |

---

## Integration Checkpoints

### Checkpoint 1: Parser Output Consistency
**When**: After config parser completes scanning
**Validate**: All shared artifacts produced from same scan. No view has stale data from a previous scan.
**Failure Mode**: User sees different file counts in Mind Map vs. Atlas. Fix: single scan produces single data model consumed by all views.

### Checkpoint 2: Scope Color Consistency
**When**: During visual regression testing of each view
**Validate**: Identical scope colors across Atlas, Mind Map, Galaxy, Cascade, Search results, and Scope legend.
**Failure Mode**: User scope is blue in Atlas but a different blue in Galaxy. Fix: single CSS custom property source.

### Checkpoint 3: Cross-View Navigation
**When**: During integration testing of view-to-view navigation
**Validate**: Clicking "View file" in Cascade opens correct file in Atlas. Clicking search result navigates to correct file. Clicking Galaxy node opens correct Cascade subsystem.
**Failure Mode**: Navigation targets wrong file or wrong view. Fix: all navigation uses canonical file identifier from parser output.

### Checkpoint 4: Precedence Accuracy
**When**: During acceptance testing with known configuration scenarios
**Validate**: Cascade ACTIVE/OVERRIDDEN markers match documented precedence rules from Research Finding 12.
**Failure Mode**: Cascade shows wrong winner. This is a critical defect -- Config Explorer's core value proposition is precedence visibility. Fix: precedence resolution as pure function with comprehensive unit tests.

### Checkpoint 5: Glob Matching Fidelity
**When**: During acceptance testing of Path Rule Tester
**Validate**: Glob matching results match Claude Code's actual matching behavior for all supported patterns.
**Failure Mode**: Path Rule Tester says MATCH but Claude Code does not load the rule (or vice versa). Fix: use same glob library (picomatch) or document known differences.

---

## CLI Vocabulary Consistency

Config Explorer is a web dashboard feature, not a CLI. However, terminology must be consistent with Claude Code's own vocabulary:

| Claude Code Term | Config Explorer Usage | Notes |
|------------------|-----------------------|-------|
| CLAUDE.md | "Memory file" or "CLAUDE.md" | Never "instruction file" or "config file" |
| settings.json | "Settings file" | Never "config file" (too generic) |
| rules | "Rules" | Never "directives" or "policies" |
| skills | "Skills" | Never "commands" (legacy term) |
| agents / subagents | "Agents" | Use "subagent" only when referring to runtime behavior |
| hooks | "Hooks" | Never "event handlers" or "callbacks" |
| plugins | "Plugins" | Never "extensions" or "packages" |
| MCP servers | "MCP servers" | Never just "servers" |
| managed | "Managed" scope | Never "admin" or "enterprise" |
| user | "User" scope | Refers to `~/.claude/` |
| project | "Project" scope | Refers to `.claude/` |
| local | "Local" scope | Refers to `*.local.*` files |
| plugin | "Plugin" scope | Refers to installed plugin files |
