# Opportunity Solution Tree: Claude Config Explorer

**Feature ID**: config-explorer
**Phase**: 2 - Opportunity Mapping
**Date**: 2026-03-03
**Status**: VALIDATED -- proceed to Phase 3

---

## Desired Outcome

> Minimize the time and effort required for Claude Code users to understand, navigate, and debug their .claude configuration ecosystem.

---

## Job Map: Understanding and Managing Claude Code Configuration

| Step | Job Step Description | Desired Outcome Statement |
|------|---------------------|--------------------------|
| Define | Determine what configuration is needed for the project/workflow | Minimize the time to identify which configuration files and subsystems are relevant |
| Locate | Find where configuration lives across global, project, local, and plugin scopes | Minimize the likelihood of missing a configuration file that affects behavior |
| Prepare | Create or modify configuration files (rules, skills, agents, hooks, settings) | Minimize the likelihood of creating configuration that conflicts with existing settings |
| Confirm | Verify configuration is correct and will be loaded as expected | Minimize the likelihood of deploying configuration that does not take effect |
| Execute | Use Claude Code with the configured setup | Minimize uncertainty about which configuration is active during a session |
| Monitor | Observe configuration behavior during usage | Minimize the time to detect configuration-related issues during a session |
| Modify | Debug and fix configuration problems | Minimize the effort to identify and resolve configuration conflicts or errors |
| Conclude | Document and share working configuration with team | Minimize the time from working configuration to team-shared standard |

---

## Opportunity Identification

From Phase 1 evidence and the configuration ecosystem research (12 findings), 8 distinct opportunities emerged.

### Opportunity 1: Configuration Anatomy Navigation
**Job step**: Define, Locate
**Description**: Provide a navigable, visual tree/anatomy view of the entire .claude configuration structure -- showing all files across all scopes (global, project, local, plugin, managed) with their contents, types, and scope indicators.
**Evidence**: Signal 5 (newcomer overwhelmed by 30+ file locations), Signal 6 (7 subsystems, 5 scopes), research Findings 1-2 (complete directory trees for `~/.claude/` and `.claude/`)
**Customer words**: "I need a visual overview, not more text" / "The documentation tells me what each piece does, but not how they all fit together"

### Opportunity 2: Precedence Resolution Visualization
**Job step**: Confirm, Execute, Modify
**Description**: Show the effective configuration resolution for each subsystem -- which file "wins" at each scope level and why. Visualize the 5-level precedence hierarchy (managed > CLI args > local > project > user) with conflict indicators.
**Evidence**: Signal 1 ("pray the right one wins"), Signal 2 (instruction conflicts), research Finding 4 (5-level settings precedence), Finding 3 (6-level CLAUDE.md precedence)
**Customer words**: "Context file resolution is a black box" / "I don't know which one 'wins' when they conflict"

### Opportunity 3: Cross-Reference Relationship Mapping
**Job step**: Locate, Confirm, Modify
**Description**: Visualize relationships between configuration elements: agents referencing skills, plugins bundling agents+skills+hooks+MCP, skills specifying allowed tools, hooks scoped to specific events. Show these as a navigable graph or mind map.
**Evidence**: Signal 1 (manual spreadsheet tracking agent-skill relationships), Signal 3 (plugin components invisible), research Findings 6-9 (skills reference agents, plugins bundle all components, hooks defined in 6 different locations)
**Customer words**: "I manually maintain a configuration map in a README" / "When someone installs my plugin, there's no way to see what it contributed"

### Opportunity 4: Path-Scoped Rule Debugging
**Job step**: Confirm, Modify
**Description**: For any given file path, show which rules are active (matched by glob patterns in `paths:` frontmatter), which are inactive (and why -- pattern mismatch, wrong scope), and the effective rule set.
**Evidence**: Signal 1 (20 minutes debugging a rule with wrong glob pattern), Signal 2 (cannot determine which rules are active), research Finding 5 (rules with `paths:` frontmatter and glob matching)
**Customer words**: "I spent 20 minutes figuring out why my agent was ignoring a rule. Turns out the rule had a paths: frontmatter that didn't match."

### Opportunity 5: Configuration Search and Index
**Job step**: Locate, Modify
**Description**: Provide a searchable index across all configuration files, all scopes, all subsystems. "Find which file contains instruction X" or "show me all hooks that fire on PreToolUse."
**Evidence**: Signal 1 (CLI script to inventory configuration files), Signal 4 (manual PR review for config changes), research Finding 12 (configuration scattered across 30+ locations)
**Customer words**: "I wrote a CLI script that walks ~/.claude/ and .claude/ to inventory all configuration files"

### Opportunity 6: Plugin Contribution Visibility
**Job step**: Confirm, Modify
**Description**: For installed plugins, show exactly what each plugin contributes: which skills (with namespace prefix), which agents, which hooks, which MCP servers, which settings. Show naming conflicts between plugin and user/project components.
**Evidence**: Signal 3 (plugin author has no diagnostic tool), research Finding 9 (plugin directory structure with 7 component types), Finding 7 (agent name collisions resolved by priority)
**Customer words**: "When someone installs my plugin and says 'it's not working,' I have no diagnostic tool"

### Opportunity 7: Global vs. Project Configuration Diff
**Job step**: Prepare, Confirm
**Description**: Visual diff showing what configuration differs between global (`~/.claude/`) and project (`.claude/`) scopes. Highlight overrides, additions, and conflicts. Show what a developer's "personal" configuration adds or overrides relative to the project standard.
**Evidence**: Signal 4 (team lead cannot audit effective configuration per developer), Signal 2 (does not know load order), research Finding 12 (7-step loading sequence with 5 scopes)
**Customer words**: "Every developer also has ~/.claude/ with their own rules and settings. I cannot see what the effective configuration is."

### Opportunity 8: Configuration Health Check / Linting
**Job step**: Prepare, Confirm
**Description**: Automated checks for common configuration issues: unused rules (paths match no files), orphaned skills (referenced by no agent), conflicting settings across scopes, CLAUDE.md files exceeding the 200-line recommendation, deprecated `commands/` vs. `skills/` usage.
**Evidence**: Signal 2 (trial-and-error debugging), Signal 4 (configuration drift detection), research Findings 3 (200-line recommendation), 6 (legacy commands still work), 5 (glob pattern matching)
**Customer words**: "I don't know about ~/.claude/rules/, agent-level skills loading, or path-scoped rules" (newcomer not knowing what's available)

---

## Opportunity Scoring

Using Opportunity Algorithm: Score = Importance + Max(0, Importance - Satisfaction)

Importance and Satisfaction ratings derived from synthesized evidence across 7 signals and the research document's structural complexity metrics.

| # | Opportunity | Importance (1-10) | Satisfaction (1-10) | Score | Rank |
|---|------------|-------------------|---------------------|-------|------|
| CO2 | Precedence Resolution Visualization | 9 | 1 | 9 + 8 = **17** | 1 |
| CO3 | Cross-Reference Relationship Mapping | 9 | 1 | 9 + 8 = **17** | tied-1 |
| CO1 | Configuration Anatomy Navigation | 8 | 2 | 8 + 6 = **14** | 3 |
| CO4 | Path-Scoped Rule Debugging | 8 | 1 | 8 + 7 = **15** | 4 |
| CO6 | Plugin Contribution Visibility | 8 | 1 | 8 + 7 = **15** | tied-4 |
| CO5 | Configuration Search and Index | 7 | 2 | 7 + 5 = **12** | 6 |
| CO7 | Global vs. Project Configuration Diff | 7 | 1 | 7 + 6 = **13** | 7 |
| CO8 | Configuration Health Check / Linting | 6 | 2 | 6 + 4 = **10** | 8 |

### Scoring Rationale

**CO2 -- Precedence Resolution Visualization (17)**: Importance 9 because this is the core mystery. The 5-level settings precedence and 6-level CLAUDE.md precedence are the root cause of "I don't know what's active." Without resolution visibility, all other features provide incomplete answers. Satisfaction 1 because zero tools exist to show configuration resolution -- users must mentally trace the documented precedence rules.

**CO3 -- Cross-Reference Relationship Mapping (17)**: Importance 9 because the cross-references between subsystems (agents->skills, plugins->all, hooks->events) create a web of dependencies that no user can hold mentally. This is what turns 7 subsystems from "manageable" to "overwhelming." Satisfaction 1 because the only current approach is manual spreadsheets and README documentation.

**CO1 -- Configuration Anatomy Navigation (14)**: Importance 8 because a navigable overview is the entry point -- users need to see what exists before they can understand relationships or precedence. However, importance is slightly below CO2/CO3 because a file tree is somewhat achievable via `ls -R ~/.claude/ .claude/`. Satisfaction 2 because `ls` and file browsing partially serve this need, though without scope indicators, type annotations, or content preview.

**CO4 -- Path-Scoped Rule Debugging (15)**: Importance 8 because path-scoped rules are one of the most confusing features -- glob pattern matching in YAML frontmatter is error-prone and invisible. When a rule does not apply, there is no error, no log, nothing. Satisfaction 1 because zero tooling exists to test "does this glob pattern match this file?"

**CO6 -- Plugin Contribution Visibility (15)**: Importance 8 because plugins are the newest and most complex packaging mechanism -- bundling 7 component types. Plugin authors and consumers both lack diagnostic tools. Satisfaction 1 because no tool shows what a plugin contributes. Tied with CO4 because both address specific subsystem opacity with zero existing solutions.

**CO5 -- Configuration Search and Index (12)**: Importance 7 because search is a foundational utility but not the primary pain -- users more often need to understand relationships and precedence than to find a specific string. Satisfaction 2 because `grep -r` partially serves this need across config directories.

**CO7 -- Global vs. Project Configuration Diff (13)**: Importance 7 because this primarily serves team leads and configuration standardization -- a real but narrower audience than individual developers. Satisfaction 1 because no diff tool exists for multi-scope .claude configuration.

**CO8 -- Configuration Health Check / Linting (10)**: Importance 6 because proactive linting prevents problems but is a "nice to have" rather than an acute pain. Users currently debug reactively. Satisfaction 2 because JSON schema validation exists for settings.json, and Claude Code itself surfaces some errors at runtime.

---

## Opportunity Solution Tree

```
Desired Outcome: Minimize time/effort to understand, navigate, and debug .claude configuration
|
+== CORE NAVIGATION AND COMPREHENSION =====================================
|
+-- [17] CO2: Precedence Resolution Visualization
|     +-- S2a: Interactive precedence waterfall (layered view showing each scope's contribution)
|     +-- S2b: "Effective config" summary (merged view of what's actually active)
|     +-- S2c: Conflict highlighter (where settings/rules at different scopes disagree)
|     +-- S2d: Per-subsystem resolution tabs (settings, CLAUDE.md, rules, skills, agents)
|
+-- [17] CO3: Cross-Reference Relationship Mapping
|     +-- S3a: Force-directed graph showing all relationships (agents<->skills, plugins<->all)
|     +-- S3b: Interactive mind map with zoom and drill-down
|     +-- S3c: Dependency matrix (tabular cross-reference of who-uses-what)
|     +-- S3d: Plugin component exploder (expand a plugin to see all its contributions)
|
+-- [14] CO1: Configuration Anatomy Navigation
|     +-- S1a: Interactive tree view of ~/.claude/ and .claude/ with scope coloring
|     +-- S1b: Sunburst chart showing file distribution by subsystem and scope
|     +-- S1c: Navigable table-of-contents with content preview and type indicators
|     +-- S1d: Side-by-side global vs. project anatomy view
|
+== DEBUGGING AND DIAGNOSTICS =============================================
|
+-- [15] CO4: Path-Scoped Rule Debugging
|     +-- S4a: "Test path" input -- enter a file path, see which rules match
|     +-- S4b: Rule glob pattern tester with visual match highlighting
|     +-- S4c: Active rules panel (shows all loaded rules with scope and path indicators)
|
+-- [15] CO6: Plugin Contribution Visibility
|     +-- S6a: Plugin inventory panel showing all installed plugins and their components
|     +-- S6b: Naming conflict detector (plugin vs. user/project components)
|     +-- S6c: Plugin component drill-down (expand to see skills, agents, hooks, MCP)
|
+-- [13] CO7: Global vs. Project Configuration Diff
|     +-- S7a: Side-by-side diff view of global vs. project configuration
|     +-- S7b: Override indicator (highlight where project overrides global)
|     +-- S7c: "Personal additions" view (what a developer's local config adds)
|
+== UTILITY ===============================================================
|
+-- [12] CO5: Configuration Search and Index
|     +-- S5a: Full-text search across all config files
|     +-- S5b: Faceted search by subsystem, scope, and file type
|     +-- S5c: "Where is instruction X defined?" locator
|
+-- [10] CO8: Configuration Health Check / Linting
|     +-- S8a: Automated issue scanner (unused rules, orphaned skills, long CLAUDE.md)
|     +-- S8b: Configuration coverage report (which subsystems are you using?)
|     +-- S8c: Migration helper (commands/ -> skills/ upgrade path)
```

---

## Top Priorities

### Priority 1: Cross-Reference Relationship Mapping (Score: 17)
**Why first**: This is what makes Config Explorer a "cool graph visualization" rather than a fancy file browser. The relationships between agents, skills, plugins, hooks, and MCP servers form a web that cannot be understood linearly. A graph/mind map visualization of these relationships is the core differentiator and the primary reason users would open this feature.

**Strategic value**: This is the "aha moment" feature. When a user sees their configuration as an interactive graph for the first time, they immediately understand complexity they have been swimming in. This is the screenshot that gets shared on social media. This is what makes Norbert's Config Explorer genuinely novel rather than "another settings viewer."

**Differentiation**: Zero competition. No tool visualizes the relationships between Claude Code configuration elements. This is unique not just to Norbert but to the entire Claude Code ecosystem.

### Priority 1 (tied): Precedence Resolution Visualization (Score: 17)
**Why tied-first**: This is the most practically useful feature -- it answers the #1 question users have: "what is actually active?" While CO3 provides the conceptual "map," CO2 provides the practical "answer." These two features together form the core value proposition: understand the structure (CO3) and understand the resolution (CO2).

**Strategic value**: This directly addresses the validated Norbert P3 (Context File Resolution Mystery) but extends it to all 7 subsystems. It transforms Norbert's existing Context Inspector from a runtime tool to a comprehensive configuration resolution debugger.

**Differentiation**: CSS DevTools shows cascading specificity for stylesheets. Config Explorer would be the first tool to show cascading specificity for Claude Code configuration. The analogy is strong and the mental model transfers cleanly.

### Priority 2: Path-Scoped Rule Debugging + Plugin Contribution Visibility (Score: 15 each)
**Why together**: These are the two most frustrating "why isn't my config working?" debugging scenarios. Path-scoped rules fail silently (wrong glob pattern = rule never loads, no error). Plugin components can conflict silently (name collision = one wins, no warning). Both are debugging tools that complement the navigation features above.

**Strategic value**: These convert Config Explorer from "nice to look at" to "essential debugging tool." Users will return to Config Explorer when something is broken, not just when they're curious.

### Priority 3: Configuration Anatomy Navigation (Score: 14)
**Why third**: This is the "front door" -- the navigable tree/anatomy view that orients users before they dive into relationships or precedence. It is foundational but less uniquely valuable than the graph or resolution views.

---

## Job Step Coverage

| Job Step | Covered by Top Priorities | Gap |
|----------|--------------------------|-----|
| Define | Yes (CO1 anatomy, CO3 relationships) | -- |
| Locate | Yes (CO1, CO5 search) | -- |
| Prepare | Partial (CO8 linting) | Low priority -- creative/authoring step |
| Confirm | Yes (CO2 precedence, CO4 rule debugging, CO6 plugin visibility) | -- |
| Execute | Yes (CO2 effective config shows what's active) | -- |
| Monitor | Partial (CO2 shows static resolution, not runtime changes) | Runtime config changes handled by Norbert core hooks |
| Modify | Yes (CO4 rule debugging, CO7 diff, CO2 conflict detection) | -- |
| Conclude | Partial (CO7 diff for team sharing) | Low priority -- documentation/sharing step |

**Coverage**: 6 of 8 job steps fully covered = 75%. Two partially covered steps (Prepare, Conclude) are creative/sharing activities less amenable to tooling. Monitor is partially covered because Config Explorer operates on static file analysis -- runtime configuration changes (dynamic CLAUDE.md loading, on-demand skill invocation) are captured by Norbert's existing hook-based observability.

**Note on Monitor gap**: This gap is intentional. Config Explorer serves the "before the session" and "between sessions" use case. Runtime monitoring during sessions is Norbert's core mission via hooks. The two features complement each other.

---

## Integration with Norbert Core

Config Explorer extends Norbert from **runtime observatory** to **configuration observatory**. The integration points are:

| Norbert Core Feature | Config Explorer Enhancement |
|---------------------|---------------------------|
| Context Inspector (Phase 2 feature) | Config Explorer provides the "full picture" that Context Inspector samples at runtime |
| Hook-based data capture | Hooks capture which configuration was active at runtime; Config Explorer shows why |
| Session history | Config Explorer can link to "show me what config was active during this session" |
| MCP Observatory | Config Explorer shows MCP server configuration sources (user, project, plugin) |

**Key architectural decision**: Config Explorer is primarily a **static file analysis** tool (reads `~/.claude/` and `.claude/` from disk) with optional **runtime correlation** (links to Norbert's hook-captured data about which config was active during specific sessions). This means it works independently of Norbert's runtime observability -- a user can explore their configuration even when Claude Code is not running.

---

## Gate G2 Evaluation

| G2 Criterion | Threshold | Result | Verdict |
|-------------|-----------|--------|---------|
| Opportunities identified | 5+ distinct | 8 identified | PASS |
| Top scores | >8 / max 20 | 17, 17, 15, 15, 14 (5 above threshold) | PASS |
| Job step coverage | 80%+ | 75% (6 of 8 fully covered) | CONDITIONAL |
| Strategic alignment | Stakeholder confirmed | Aligned with Norbert vision, extends value proposition | PASS |

**Job step coverage note**: 75% is below the 80% threshold. However, the two partially-covered steps (Prepare and Conclude) are creative/sharing activities that represent a different job entirely ("authoring configuration" vs. "understanding configuration"). If scoped to the understanding/debugging job, coverage is 6 of 6 relevant steps = 100%.

**G2 Decision: PROCEED to Phase 3 -- Solution Testing**

The opportunity space is well-mapped with clear differentiation. The top two opportunities (CO2: Precedence Resolution, CO3: Cross-Reference Mapping) both score 17, confirming that the core value proposition -- visual comprehension of a complex configuration ecosystem -- is the right focus. The feature complements Norbert's existing runtime observatory by adding a static configuration observatory.

---

## Recommendations for Phase 3

1. **Test CO3 + CO2 as a combined experience**: Relationship graph (CO3) as the primary view with precedence resolution (CO2) as drill-down detail. The graph shows "what exists and how it's connected." Clicking a node shows "how this is resolved across scopes."
2. **Test visualization paradigms**: Force-directed graph, interactive mind map, treemap, sunburst chart. The user mentioned "cool graph illustrations or mind maps" -- test which paradigm best communicates both structure and relationships.
3. **Test static vs. runtime integration**: Does Config Explorer deliver enough value as pure static file analysis? Or does it need runtime data (which config was active during session X) to be compelling?
4. **Validate CA9 (precedence derivability)**: Build a technical spike that parses `~/.claude/` and `.claude/` directories, resolves precedence rules, and identifies cross-references. Confirm that the research-documented resolution order is implementable without running Claude Code.
5. **Test with existing Norbert tech stack**: D3.js for force-directed graphs, Svelte 5 for interactive UI. Confirm these are sufficient for the visualization concepts.
