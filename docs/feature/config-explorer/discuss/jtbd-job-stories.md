# JTBD Job Stories: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 1 (JTBD Analysis)
**Date**: 2026-03-03
**Source**: DISCOVER wave artifacts (problem-validation.md, opportunity-tree.md, solution-testing.md, lean-canvas.md)

---

## Job Classification

**Job Type**: Build Something New (Greenfield within existing Norbert product)
**Workflow**: research -> discuss -> design -> distill -> baseline -> roadmap -> split -> execute -> review
**Current Phase**: DISCUSS (requirements and journey design)

---

## Job Stories

### JS-01: Understand Overall Config Structure

**When** I open a Claude Code project that has configurations spread across `~/.claude/`, `.claude/`, installed plugins, and managed settings,
**I want to** see a navigable overview of every configuration file organized by subsystem and scope,
**so I can** form a mental model of what exists and how it is organized without manually walking directory trees.

#### Functional Job
Discover all configuration files across 5 scopes (managed, user, project, local, plugin) and 7 subsystems (memory, settings, rules, skills, agents, hooks, plugins) in one place.

#### Emotional Job
Feel oriented and in control of a complex system rather than overwhelmed by scattered files and fragmented documentation.

#### Social Job
Be seen as someone who understands their tooling deeply -- able to answer "what is configured?" when asked by a teammate.

#### Evidence
- Signal 5: Newcomer overwhelmed by 30+ file locations across 7 subsystems
- Signal 6: Structural complexity -- 676 lines of research documenting 7 subsystems, 5 scopes, 30+ paths
- Signal 1: Framework developer wrote a CLI script to inventory all configuration files
- Research Finding 12: 7-step loading sequence spanning 5 scopes

---

### JS-02: Debug Why a Configuration Is Not Taking Effect

**When** I have added or modified a configuration file (rule, skill, agent, or setting) and Claude Code appears to ignore it,
**I want to** see the full precedence resolution for that subsystem -- which files are loaded, in what order, and which one "wins" at each scope level,
**so I can** identify the override or conflict that is suppressing my configuration without mentally tracing the documented precedence rules.

#### Functional Job
Trace the configuration resolution chain for any subsystem to identify which scope-level file is overriding or suppressing the intended configuration.

#### Emotional Job
Feel relief instead of frustration when debugging configuration issues -- from "black box" to "I can see exactly why."

#### Social Job
Avoid the embarrassment of spending 30+ minutes on a configuration issue that a visual tool would have revealed in seconds.

#### Evidence
- Signal 1: "Context file resolution is a black box -- I configure 15 CLAUDE.md files and pray the right one wins"
- Signal 1: Spent 30+ minutes debugging wrong context for a subagent (incorrect glob pattern)
- Signal 2: Experienced "instruction conflicts" where global CLAUDE.md contradicts project CLAUDE.md
- Signal 2: Added `claudeMdExcludes` but unsure whether it works
- Research Finding 4: 5-level settings precedence (managed > CLI args > local > project > user)
- Research Finding 3: 6-level CLAUDE.md precedence with on-demand subdirectory loading

---

### JS-03: Explore Relationships Between Config Elements

**When** I am managing a Claude Code setup with agents that reference skills, plugins that bundle multiple components, and hooks defined in several locations,
**I want to** see a visual graph of all cross-references between configuration elements,
**so I can** understand the dependency web and trace any element back to its sources without maintaining manual spreadsheets.

#### Functional Job
Visualize and navigate the cross-reference relationships: agents referencing skills (via `skills:` field), plugins containing agents+skills+hooks+MCP, hooks scoped to specific events, rules scoped to file patterns.

#### Emotional Job
Feel confident that the mental model in my head matches reality -- replace uncertainty with visual proof.

#### Social Job
Demonstrate deep understanding of configuration architecture to colleagues and plugin users by showing them an interactive map.

#### Evidence
- Signal 1: Created a spreadsheet to manually track which skills are loaded by which agents
- Signal 1: Manually maintains a "configuration map" in a README
- Signal 3: Plugin author cannot verify what a plugin contributes to a consumer's configuration
- Research Finding 6: Skills with `allowed-tools` field, agent references in `skills:` field
- Research Finding 7: Subagent priority determines which agent wins on name collision
- Research Finding 9: Plugins bundle 7 component types (skills, agents, hooks, MCP, LSP, commands, settings)

---

### JS-04: Debug Path-Scoped Rule Loading

**When** I have rules in `.claude/rules/` with `paths:` frontmatter that restrict them to specific file patterns, and a rule does not appear to be loading for the files I expect,
**I want to** enter a file path and see which rules match (and which do not, with the reason),
**so I can** fix incorrect glob patterns or scope mismatches immediately instead of through trial and error.

#### Functional Job
Test glob pattern matching for path-scoped rules: given a file path, display matched rules, unmatched rules, and the specific pattern mismatch reason.

#### Emotional Job
Feel empowered to use path-scoped rules confidently rather than avoiding them because they fail silently.

#### Social Job
Be the person on the team who can explain "here is exactly why that rule does not apply to your file."

#### Evidence
- Signal 1: "I spent 20 minutes figuring out why my agent was ignoring a rule. Turns out the rule had a `paths:` frontmatter that didn't match the file pattern."
- Signal 2: Cannot determine which path-scoped rules are active for specific files
- Research Finding 5: Rules with `paths:` frontmatter and glob matching, no error when pattern does not match
- CP3: Path-scoped rule opacity -- rules load silently or do not load, no diagnostic path

---

### JS-05: Verify Plugin Contributions

**When** I have installed a Claude Code plugin (or am a plugin author testing my plugin), and I need to know what the plugin contributes to the effective configuration,
**I want to** see every component the plugin provides (skills, agents, hooks, MCP servers, settings) and detect any naming conflicts with existing user or project components,
**so I can** diagnose "plugin not working" issues or QA my plugin before publishing.

#### Functional Job
Enumerate all components contributed by an installed plugin, show their namespacing, and detect naming collisions between plugin-provided and user/project-provided elements.

#### Emotional Job
Feel professional confidence when publishing a plugin or supporting plugin users -- replace "I have no diagnostic tool" with "I can see exactly what my plugin contributes."

#### Social Job
Build trust with plugin users by providing a verifiable, visual inventory of what the plugin adds to their configuration.

#### Evidence
- Signal 3: "When someone installs my plugin and says 'it's not working,' I have no diagnostic tool"
- Signal 3: Received bug reports caused by naming conflict between plugin agent and user's existing agent
- Signal 3: Manually tests plugins by installing and inspecting each component individually
- Research Finding 9: Plugin directory structure with 7 component types, `plugin-name:skill-name` namespacing
- Research Finding 7: Agent name collisions resolved by priority (project > user > plugin)

---

### JS-06: Audit Team Configuration Compliance

**When** I am a team lead responsible for standardized Claude Code configuration across my team, and developers have personal configurations (`~/.claude/`) that may diverge from or conflict with project standards (`.claude/`),
**I want to** see what the effective configuration looks like with both project and user configurations combined, highlighting overrides and additions,
**so I can** identify configuration drift and ensure team members are working with the intended setup.

#### Functional Job
Compare user-scope configuration with project-scope configuration, showing what user config adds, overrides, or conflicts with the project standard.

#### Emotional Job
Feel assured that the team configuration I carefully built is actually being used as intended.

#### Social Job
Be a responsible team lead who can demonstrate that configuration standards are enforced and auditable.

#### Evidence
- Signal 4: Created a team wiki page documenting "what goes in which configuration file and why"
- Signal 4: Cannot audit what each developer's effective configuration actually is
- Signal 4: Manually reviews `.claude/` directories in PRs to check for configuration issues
- CP6: Configuration drift detection -- personal rules, local settings, user CLAUDE.md create invisible divergence

---

### JS-07: Discover Available Configuration Options (Newcomer)

**When** I am relatively new to Claude Code and have a basic `CLAUDE.md` and `settings.json`, but I know the configuration system has much more to offer (agents, skills, hooks, plugins, rules),
**I want to** see a visual map of all configuration subsystems with indicators for what I have configured and what I have not yet explored,
**so I can** progressively discover and adopt advanced configuration features without reading 600+ lines of documentation.

#### Functional Job
Display the complete configuration taxonomy (7 subsystems, 5 scopes) with indicators distinguishing configured vs. unconfigured areas, and provide entry points to learn about each.

#### Emotional Job
Feel curious and excited about possibilities rather than intimidated by complexity. Transform "I don't know what I don't know" into "here is what I can explore next."

#### Social Job
Progress from beginner to power user visibly -- be able to say "I added agents and skills to my setup" after discovering them through the tool.

#### Evidence
- Signal 5: Does not understand the full scope of what is configurable
- Signal 5: Has not created agents, skills, or hooks because "I don't understand how they all fit together"
- Signal 5: "The documentation tells me what each piece does, but not how they all fit together. I need a visual overview, not more text."
- CP4: Ecosystem comprehension barrier -- 7 subsystems, 5 scopes, 30+ file locations

---

### JS-08: Search Across All Configuration

**When** I know I defined an instruction, rule, or setting somewhere in my configuration but cannot remember which file it is in,
**I want to** search across all configuration files (all scopes, all subsystems, all formats) with a single query,
**so I can** locate the definition quickly without manually grepping through directories.

#### Functional Job
Full-text search across all configuration files in `~/.claude/`, `.claude/`, installed plugins, and managed settings, returning file location, scope, subsystem, and matching content.

#### Emotional Job
Feel efficient rather than scattered -- one search replaces manual directory walking.

#### Social Job
Minimal -- this is a personal productivity tool.

#### Evidence
- Signal 1: CLI script that walks `~/.claude/` and `.claude/` to inventory configuration files
- Signal 4: Manual PR review for config changes (looking for specific instructions)
- CO5: Configuration Search and Index (score 12 -- utility feature)

---

## Job Story Summary

| ID | Job | Primary Persona | Opportunity | Priority |
|----|-----|----------------|-------------|----------|
| JS-01 | Understand overall config structure | All users | CO1 (14) | Must Have |
| JS-02 | Debug why config not taking effect | Power users, framework devs | CO2 (17) | Must Have |
| JS-03 | Explore config relationships | Framework devs, plugin authors | CO3 (17) | Must Have |
| JS-04 | Debug path-scoped rule loading | Power users, framework devs | CO4 (15) | Must Have |
| JS-05 | Verify plugin contributions | Plugin authors, plugin consumers | CO6 (15) | Should Have |
| JS-06 | Audit team config compliance | Team leads | CO7 (13) | Could Have (v2) |
| JS-07 | Discover available config options | Newcomers | CO1 (14) | Should Have |
| JS-08 | Search across all configuration | All users | CO5 (12) | Should Have |

---

## Job-to-View Mapping

| Job | Primary View | Secondary Views |
|-----|-------------|----------------|
| JS-01 | Config Atlas (Anatomy) | Config Mind (Mind Map) |
| JS-02 | Config Cascade (Waterfall) | Config Atlas (locate files) |
| JS-03 | Config Galaxy (Relationship Graph) | Config Mind (overview first) |
| JS-04 | Path Rule Tester | Config Atlas (browse rules) |
| JS-05 | Config Galaxy (plugin explosion) | Config Cascade (precedence check) |
| JS-06 | Config Cascade (scope comparison) | Config Atlas (side-by-side) |
| JS-07 | Config Atlas (missing file indicators) | Config Mind (subsystem branches) |
| JS-08 | Search | All views (search navigates to results) |
