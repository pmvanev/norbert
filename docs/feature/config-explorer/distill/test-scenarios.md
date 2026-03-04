# Test Scenarios: Config Explorer

**Feature ID**: config-explorer
**Phase**: DISTILL (Acceptance Test Design)
**Date**: 2026-03-03

---

## Test Strategy

### Driving Port

All acceptance tests invoke Config Explorer through a single driving port: the **Fastify HTTP API** serving `/api/config/*` endpoints. No internal `@norbert/config-explorer` modules are imported by test code.

### Dependency Inversion

The `ConfigFileReaderPort` is the dependency inversion boundary. Acceptance tests inject a **fake implementation** that returns synthetic config file data from in-memory fixtures. The parser, precedence resolver, glob matcher, and API routes are all **real production code**.

### What Is Tested

- Config file parsing (JSON, Markdown, YAML frontmatter)
- File classification by scope and subsystem
- Precedence resolution across 5 scopes
- Cross-reference extraction (agent->skill, plugin->component)
- Glob pattern matching for path-scoped rules
- Full-text search across all config files
- Error isolation (malformed files do not affect others)
- Graceful degradation (missing files, access denied)

### What Is NOT Tested Here

- Svelte component rendering (UI tests are separate)
- D3.js graph layout and interaction
- CSS scope coloring (visual regression tests)
- Keyboard shortcuts (Cmd+K)
- Cross-platform filesystem path resolution (integration tests with real filesystem)

---

## Story-to-Scenario Traceability

### US-CE-07: Walking Skeleton (P0)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Developer sees settings from both user and project scopes | Walking skeleton | AC-07-01, AC-07-05 |
| Missing user settings file shown as placeholder | Walking skeleton | AC-07-03 |
| Malformed settings file shows parse error without affecting other files | Error | AC-07-04 |

**Total**: 3 scenarios (1 error = 33% error ratio)

### US-CE-01: Configuration Precedence Waterfall (P1)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Hook override identified via cascade waterfall | Walking skeleton | AC-01-01, AC-01-02, AC-01-03, AC-01-04 |
| Memory files shown as additive in the cascade | Happy path | AC-01-05 |
| Permission settings show merged values with source tagging | Happy path | AC-01-06 |
| Cascade supports all 7 subsystem categories | Happy path | AC-01-09 |
| Subdirectory memory file labeled as loaded on-demand | Edge case | AC-01-08 |
| Managed scope shows access denied when permissions are insufficient | Error | AC-01-07 |
| Cascade for unconfigured subsystem shows all scopes as empty | Error | AC-01-xx |
| Override reason identifies the specific overriding file | Edge case | AC-01-04 |

**Total**: 8 scenarios (2 error + 2 edge = 50% non-happy ratio)

### US-CE-02: Configuration Anatomy Tree (P1)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Developer sees complete configuration tree with scope annotations | Walking skeleton | AC-02-01, AC-02-02, AC-02-03, AC-02-04 |
| Rule file content includes path scope annotation | Happy path | AC-02-05, AC-02-06 |
| Files classified by subsystem type | Happy path | AC-02-04 |
| Expected but missing directories indicated in tree | Edge case | AC-02-07, AC-02-08 |
| Malformed settings file shown with parse error in tree | Error | AC-02-09, AC-02-10 |
| Project with no .claude/ directory shows available subsystems | Error | AC-02-07 |

**Total**: 6 scenarios (2 error + 1 edge = 50% non-happy ratio)

### US-CE-04: Path Rule Tester (P1)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Developer tests a file path against all rules | Walking skeleton | AC-04-01 through AC-04-04 |
| Test file matches both API and testing rules | Happy path | AC-04-02 |
| Rules from both scopes included in test results | Happy path | AC-04-06 |
| Project with only unconditional rules shows all as matching | Edge case | AC-04-04 |
| Rule with negation pattern correctly excludes files | Edge case | AC-04-07 |
| Empty file path produces validation error | Error | AC-04-01 |
| Deeply nested file path matches recursive glob pattern | Edge case | AC-04-07 |
| Unconditional rules match any valid file path | Property | AC-04-04 |

**Total**: 8 scenarios (1 error + 3 edge + 1 property = 63% non-happy ratio)

### US-CE-05: Configuration Mind Map (P2)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Developer sees 8 subsystem branches with element counts | Walking skeleton | AC-05-01, AC-05-02 |
| Each subsystem branch shows scope distribution | Happy path | AC-05-03 |
| Minimal configuration shows active and empty subsystems | Edge case | AC-05-06 |
| Subsystem counts in the model match the file tree totals | Property | AC-05-02 |

**Total**: 4 scenarios (1 edge + 1 property = 50% non-happy ratio)

### US-CE-03: Configuration Relationship Graph (P2)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Developer sees agent-to-skill relationships in the model | Walking skeleton | AC-03-03, AC-03-02 |
| Configuration elements classified by node type | Happy path | AC-03-01 |
| Plugin skills show namespace prefix in the model | Happy path | AC-03-06 |
| Naming conflict detected between plugin and project agent | Error | AC-03-07, AC-03-08 |
| Agent referencing an undefined skill reported as unresolved | Edge case | AC-03-03 |
| Every node in the model includes scope information | Edge case | AC-03-02 |
| Every cross-reference in frontmatter produces a relationship edge | Property | AC-03-03 |

**Total**: 7 scenarios (1 error + 2 edge + 1 property = 57% non-happy ratio)

### US-CE-06: Configuration Search (P2)

| Scenario | Type | AC Coverage |
|----------|------|-------------|
| Developer searches for hooks across all scopes | Walking skeleton | AC-06-01, AC-06-02 |
| Search for a setting key finds all defining files | Happy path | AC-06-02 |
| Search for absent term shows no results with guidance | Error | AC-06-04 |
| Search requires a minimum query length | Edge case | AC-06-01 |
| Search finds matches in both settings files and rule files | Happy path | AC-06-02 |
| Search handles special characters without errors | Error | AC-06-01 |

**Total**: 6 scenarios (2 error + 1 edge = 50% non-happy ratio)

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total scenarios | 42 |
| Walking skeletons | 9 |
| Happy path | 12 |
| Error scenarios | 12 |
| Edge case scenarios | 10 |
| Property scenarios | 4 |
| Error+edge ratio | 52% (exceeds 40% target) |
| Stories covered | 7/7 (100%) |
| ACs covered | 42/42 story-level + 7/7 cross-cutting acknowledged |

---

## Property-Shaped Scenarios

Tagged `@property` for the DELIVER wave crafter to implement as property-based tests:

1. **Unconditional rules match any valid file path** (US-CE-04) -- For any rule without `paths:` frontmatter, any valid file path always produces MATCH.

2. **Subsystem counts in the model match the file tree totals** (US-CE-05) -- For any valid configuration, the count of files per subsystem in the model equals the count in the tree.

3. **Every cross-reference in frontmatter produces a relationship edge** (US-CE-03) -- For any agent with N skills in its `skills:` list, the model contains exactly N edges from that agent.

4. **Event ordering in storage matches timestamp ordering** (inherited from norbert core, not config-explorer-specific -- noted for completeness).

---

## Implementation Sequence

The one-at-a-time implementation order for the DELIVER wave:

1. `walking-skeleton.feature` -- **Enable first** (no @skip tag)
2. `milestone-1-cascade.feature` -- Remove @skip after walking skeleton passes
3. `milestone-2-atlas.feature` -- Remove @skip after cascade passes
4. `milestone-3-path-rule-tester.feature` -- Remove @skip after atlas passes
5. `milestone-4-mind-map.feature` -- Remove @skip after path tester passes
6. `milestone-5-galaxy.feature` -- Remove @skip after mind map passes
7. `milestone-6-search.feature` -- Remove @skip after galaxy passes

Within each milestone, enable scenarios one at a time (top to bottom).
