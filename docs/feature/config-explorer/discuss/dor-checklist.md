# Definition of Ready Checklist: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISCUSS -- Phase 5 (Validate and Handoff)
**Date**: 2026-03-03

---

## DoR Validation: US-CE-07 (Walking Skeleton)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Before building the full Config Explorer, the team needs to validate the end-to-end data pipeline: filesystem reading, JSON parsing, API serving, and Svelte rendering with scope coloring." Uses domain terms (settings.json, scopes, Fastify, Svelte). |
| 2. User/persona identified with specific characteristics | **PASS** | Development team validating architecture. This is a technical task enabling all subsequent user-facing stories. |
| 3. At least 3 domain examples with real data | **PASS** | 3 examples: (1) Two-scope settings display with real JSON content, (2) Missing user settings file, (3) Invalid JSON with parse error. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 3 scenarios: two-scope display, missing file, invalid JSON. Right-sized for a walking skeleton. |
| 5. AC derived from UAT | **PASS** | 5 ACs (AC-07-01 through AC-07-05) each traceable to a scenario. |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~1 day effort, 3 scenarios, single demonstrable outcome. |
| 7. Technical notes identify constraints | **PASS** | Identifies Fastify route, Svelte component, cross-platform path handling, and dependency chain. |
| 8. Dependencies resolved or tracked | **PASS** | No external dependencies. Uses existing Norbert infrastructure (Fastify, Svelte, pnpm workspace). Creates FR-01 foundation. |

**DoR Status: PASSED**

---

## DoR Validation: US-CE-01 (Cascade Waterfall)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Ravi Patel is a senior developer managing a monorepo with 5 CLAUDE.md files, path-scoped rules, and hooks defined in 3 locations. He finds it maddening to debug configuration overrides because the 5-level precedence hierarchy is invisible." Uses domain terms (precedence, scope, CLAUDE.md, hooks). |
| 2. User/persona identified with specific characteristics | **PASS** | Ravi Patel, senior developer, monorepo, 5 CLAUDE.md files, hooks in 3 locations, spent 30+ minutes debugging override. |
| 3. At least 3 domain examples with real data | **PASS** | 4 examples: (1) Hook override debug with real file paths and commands, (2) CLAUDE.md accumulation with 3 files, (3) Permissions array merge with specific values, (4) Managed settings access denied. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 5 scenarios covering happy path, accumulation, array merge, access denied, and on-demand labeling. |
| 5. AC derived from UAT | **PASS** | 9 ACs (AC-01-01 through AC-01-09) each traceable to one or more scenarios. |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~2-3 days effort, 5 scenarios, single demonstrable feature (precedence waterfall for one subsystem). |
| 7. Technical notes identify constraints | **PASS** | Precedence is a pure function. Documents precedence order from Research Finding 12. Notes settings vs CLAUDE.md resolution difference. Identifies parser dependency. |
| 8. Dependencies resolved or tracked | **PASS** | Depends on FR-01 (config parser) -- tracked. Walking skeleton (US-CE-07) provides foundation. |

**DoR Status: PASSED**

---

## DoR Validation: US-CE-02 (Atlas Tree)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Kenji Tanaka is a mid-level developer who joined the norbert-nwave project 2 weeks ago. He finds it overwhelming to understand the configuration landscape -- files scattered across ~/.claude/ and .claude/ with 7 subsystems." |
| 2. User/persona identified with specific characteristics | **PASS** | Kenji Tanaka, mid-level, joined 2 weeks ago, unfamiliar with project config, uses ls -R currently. |
| 3. At least 3 domain examples with real data | **PASS** | 3 examples: (1) Browse full config tree with 14 specific files, (2) Discover unconfigured subsystems via dimmed agents/ and skills/, (3) Malformed settings.json with parse error at line 5. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 4 scenarios: browse tree, preview rule, discover unconfigured subsystems, malformed file. |
| 5. AC derived from UAT | **PASS** | 10 ACs (AC-02-01 through AC-02-10) covering tree rendering, content preview, missing files, and error handling. |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~2 days effort, 4 scenarios, single demonstrable feature (navigable tree with preview). |
| 7. Technical notes identify constraints | **PASS** | Recursive tree expansion, content preview formats (JSON, Markdown, YAML), missing file indicators based on known ecosystem, cross-platform os.homedir(). |
| 8. Dependencies resolved or tracked | **PASS** | Depends on FR-01 (config parser) -- tracked. Walking skeleton provides foundation. |

**DoR Status: PASSED**

---

## DoR Validation: US-CE-03 (Galaxy Graph)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Sofia Hernandez is a framework developer building nwave-ai with 10 skills, 5 agents, a plugin, custom hooks, and 3 MCP servers. She finds it impossible to hold the full web of cross-references in her head." |
| 2. User/persona identified with specific characteristics | **PASS** | Sofia Hernandez, framework developer, 10 skills, 5 agents, 1 plugin, maintains manual spreadsheet (~20 hours invested). |
| 3. At least 3 domain examples with real data | **PASS** | 3 examples: (1) Trace agent skills with real names (api-patterns, code-review, nw-plugin:formatting), (2) Plugin explosion showing 7 components, (3) Naming conflict between plugin and project code-reviewer agents. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 4 scenarios: agent-to-skill, subsystem filter, plugin explosion, naming conflict. |
| 5. AC derived from UAT | **PASS** | 10 ACs (AC-03-01 through AC-03-10) covering shapes, colors, edges, filtering, explosion, conflicts, and performance. |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~3 days effort, 4 scenarios. At upper bound but manageable as D3.js force simulation is established pattern. |
| 7. Technical notes identify constraints | **PASS** | D3.js force simulation, cross-references from YAML frontmatter, 100+ node performance testing, plugin namespacing rules. |
| 8. Dependencies resolved or tracked | **PASS** | Depends on FR-01 with cross-reference extraction. D3.js already in Norbert stack. |

**DoR Status: PASSED**

---

## DoR Validation: US-CE-04 (Path Rule Tester)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Mei-Lin Chen is a developer who uses path-scoped rules extensively. She finds it infuriating that path-scoped rules fail silently -- a wrong glob pattern means the rule simply never loads, with no error, no log, and no indication." |
| 2. User/persona identified with specific characteristics | **PASS** | Mei-Lin Chen, developer, monorepo, uses path-scoped rules, spent 20 minutes debugging glob pattern, avoids complex patterns. |
| 3. At least 3 domain examples with real data | **PASS** | 3 examples: (1) API file against 5 rules with specific patterns and match results, (2) Test file matches both api and testing rules, (3) No path-scoped rules exist. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 3 scenarios: test path with table of results, navigate to Atlas, no path-scoped rules. |
| 5. AC derived from UAT | **PASS** | 7 ACs (AC-04-01 through AC-04-07) covering input, match/no-match, reasons, navigation, and glob semantics. |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~1-2 days effort, 3 scenarios. Focused utility feature. |
| 7. Technical notes identify constraints | **PASS** | Picomatch library, YAML frontmatter paths: extraction, pattern segment comparison for mismatch reasons. |
| 8. Dependencies resolved or tracked | **PASS** | Depends on FR-01 (paths: extraction from rules). Picomatch is an npm package (no approval needed). |

**DoR Status: PASSED**

---

## DoR Validation: US-CE-05 (Mind Map)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Kenji (newcomer) and Sofia (expert) both need a structural overview. The mind map provides the 30,000-foot view -- 8 subsystem branches with element counts." |
| 2. User/persona identified with specific characteristics | **PASS** | Kenji Tanaka (newcomer, 2 weeks) and Sofia Hernandez (expert, 46 elements). Two personas demonstrate different usage patterns. |
| 3. At least 3 domain examples with real data | **PASS** | 3 examples: (1) Newcomer sees 8 branches with counts, (2) Expert collapses branches for focused viewing, (3) Minimal config with mostly empty branches. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 3 scenarios: view branches, collapse/expand, minimal config. |
| 5. AC derived from UAT | **PASS** | 6 ACs (AC-05-01 through AC-05-06). |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~2 days effort, 3 scenarios. |
| 7. Technical notes identify constraints | **PASS** | D3.js tree layout, cross-links optional, subsystem classification dependency. |
| 8. Dependencies resolved or tracked | **PASS** | Depends on FR-01 with subsystem classification. D3.js in stack. |

**DoR Status: PASSED**

---

## DoR Validation: US-CE-06 (Search)

| DoR Item | Status | Evidence |
|----------|--------|---------|
| 1. Problem statement clear, domain language | **PASS** | "Sofia knows she defined a PreToolUse hook somewhere but cannot remember which of the 3 possible locations. She currently runs grep -r across multiple directories." |
| 2. User/persona identified with specific characteristics | **PASS** | Sofia Hernandez, 3 hook locations, currently uses grep -r. |
| 3. At least 3 domain examples with real data | **PASS** | 3 examples: (1) Search for "PreToolUse" finds 3 results, (2) Search for "permissions" finds 2 results, (3) Search for "kubernetes" returns no results with guidance. |
| 4. UAT scenarios in Given/When/Then (3-7 scenarios) | **PASS** | 3 scenarios: search with results, no results, keyboard shortcut. |
| 5. AC derived from UAT | **PASS** | 6 ACs (AC-06-01 through AC-06-06). |
| 6. Right-sized (1-3 days, 3-7 scenarios) | **PASS** | ~1-2 days effort, 3 scenarios. |
| 7. Technical notes identify constraints | **PASS** | Full-text index, cross-format search, keyboard shortcut handling (Cmd vs Ctrl). |
| 8. Dependencies resolved or tracked | **PASS** | Depends on FR-01 (config parser). |

**DoR Status: PASSED**

---

## Summary

| Story | DoR Status | Failed Items | Remediation Needed |
|-------|-----------|-------------|-------------------|
| US-CE-07 (Walking Skeleton) | **PASSED** | None | -- |
| US-CE-01 (Cascade Waterfall) | **PASSED** | None | -- |
| US-CE-02 (Atlas Tree) | **PASSED** | None | -- |
| US-CE-03 (Galaxy Graph) | **PASSED** | None | -- |
| US-CE-04 (Path Rule Tester) | **PASSED** | None | -- |
| US-CE-05 (Mind Map) | **PASSED** | None | -- |
| US-CE-06 (Search) | **PASSED** | None | -- |

**All 7 stories pass the 8-item DoR gate. Ready for handoff to DESIGN wave.**

---

## Anti-Pattern Check

| Anti-Pattern | Detected? | Evidence |
|--------------|-----------|---------|
| Implement-X | No | All stories start from user pain: "Ravi finds it maddening", "Kenji finds it overwhelming", "Mei-Lin finds it infuriating" |
| Generic data | No | Real personas (Ravi Patel, Kenji Tanaka, Sofia Hernandez, Mei-Lin Chen, Carlos Rivera) with specific characteristics. Real file paths (src/api/routes/users.ts), real patterns (src/api/**/*.ts), real values. |
| Technical AC | No | All AC describe observable outcomes: "marked ACTIVE", "shown dimmed", "red edge between nodes". No implementation prescriptions. |
| Oversized story | No | Largest story (US-CE-03, Galaxy Graph) is ~3 days with 4 scenarios. All others 1-2 days with 3-5 scenarios. |
| Abstract requirements | No | Every story has 3+ concrete domain examples with real data. |
| No examples | No | Minimum 3 examples per story, maximum 4. |

---

## Handoff Package Contents

The following artifacts are ready for the DESIGN wave (solution-architect):

| Artifact | Path | Description |
|----------|------|-------------|
| JTBD Job Stories | `docs/feature/config-explorer/discuss/jtbd-job-stories.md` | 8 job stories with functional/emotional/social dimensions |
| Four Forces Analysis | `docs/feature/config-explorer/discuss/jtbd-four-forces.md` | Forces analysis per job with switch likelihood assessment |
| Opportunity Scores | `docs/feature/config-explorer/discuss/jtbd-opportunity-scores.md` | 19 outcome statements scored and ranked |
| Journey Visual | `docs/feature/config-explorer/discuss/journey-config-exploration-visual.md` | ASCII mockups for 3 journeys with emotional annotations |
| Journey Schema | `docs/feature/config-explorer/discuss/journey-config-exploration.yaml` | Structured YAML with steps, artifacts, integration checkpoints |
| Gherkin Scenarios | `docs/feature/config-explorer/discuss/journey-config-exploration.feature` | 22 testable acceptance scenarios |
| Shared Artifacts | `docs/feature/config-explorer/discuss/shared-artifacts-registry.md` | 11 shared artifacts with sources, consumers, integration risks |
| Requirements | `docs/feature/config-explorer/discuss/requirements.md` | Functional (9), NFR (5), Business Rules (4), Walking Skeleton evaluation |
| User Stories | `docs/feature/config-explorer/discuss/user-stories.md` | 7 stories with LeanUX template, domain examples, UAT scenarios |
| Acceptance Criteria | `docs/feature/config-explorer/discuss/acceptance-criteria.md` | 54 acceptance criteria traceable to scenarios and jobs |
| DoR Checklist | `docs/feature/config-explorer/discuss/dor-checklist.md` | All 7 stories validated, all passing |

### Key Decisions for DESIGN Wave

1. **Walking skeleton first**: US-CE-07 validates the end-to-end pipeline before any feature story.
2. **Cascade before Galaxy**: Ship precedence waterfall (highest value perception, 100%) before relationship graph (highest differentiation but more complex).
3. **Config parser is the critical path**: FR-01 (file discovery, parsing, cross-reference extraction, precedence resolution) is the foundation. All views consume its output.
4. **Glob matching library**: Must use picomatch or equivalent for Path Rule Tester fidelity.
5. **Static analysis first, runtime correlation later**: Config Explorer operates on filesystem scan. Runtime data integration (which config was active during session X) is a v2 feature.
6. **Read-only**: Config Explorer observes configuration. It never modifies files.

### Open Questions for DESIGN Wave

1. Should the config parser cache scan results? If so, cache invalidation strategy for filesystem changes.
2. Where does the config parser live in the monolith? Candidate: new module under `@norbert/server` or separate `@norbert/config-parser` package.
3. WebSocket updates for file changes (file watcher) -- include in MVP or defer?
4. Graph layout persistence -- save node positions between visits or fresh layout each time?
5. Integration with Norbert core Context Inspector -- unified or complementary views?
