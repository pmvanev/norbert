# Acceptance Test Scenarios: norbert-config

## Overview

29 acceptance test scenarios covering 7 user stories. Organized by domain capability with walking skeletons, focused scenarios, and error/boundary scenarios.

**Driving ports**: Pure domain functions in `src/plugins/norbert-config/domain/` (agentParser, settingsParser, skillParser, configAggregator). Tests exercise data transformation, not React rendering or Rust backend.

**Error path ratio**: 13 error/boundary scenarios out of 29 total = 45% (target: >= 40%)

## Test Files

| File | Stories | Scenarios | Type |
|------|---------|-----------|------|
| `agent-parser.test.ts` | US-002 | 6 | Walking skeleton + focused + error |
| `settings-parser.test.ts` | US-003, US-004 | 9 | Walking skeleton + focused + error |
| `skill-parser.test.ts` | US-005 | 5 | Focused + error |
| `config-aggregator.test.ts` | US-001, US-005, US-006, US-007 | 9 | Walking skeleton + focused + error |

## Walking Skeletons (3)

### WS-1: User browses agent definitions and sees key metadata (US-002)
- **File**: `agent-parser.test.ts`
- **Validates**: Agent file parsed into browsable definition with name, model, tools, description
- **User value**: "Can a user see their agent's model and tool list without reading raw files?"

### WS-2: User views hook bindings to verify configuration (US-003)
- **File**: `settings-parser.test.ts`
- **Validates**: Settings JSON parsed into structured hook cards with event type, command, matchers
- **User value**: "Can a user verify their hook wiring without reading nested JSON?"

### WS-3: User sees all configuration categories from their .claude/ directory (US-001, US-007)
- **File**: `config-aggregator.test.ts`
- **Validates**: Raw config data aggregated into scoped, source-annotated categories for all 7 tabs
- **User value**: "Can a user see a consolidated view of all configuration in one place?"

## Scenario Inventory

### agent-parser.test.ts (US-002)

| # | Scenario | Category |
|---|----------|----------|
| 1 | User browses agent definitions and sees key metadata | Walking skeleton |
| 2 | Agent name derived from filename | Focused |
| 3 | Agent with minimal metadata shows sensible defaults | Focused (edge) |
| 4 | Agent with declared tools shows tool count and names | Focused |
| 5 | Empty agent file produces parse error | Error |
| 6 | Agent with no frontmatter but valid content still parses | Boundary |

### settings-parser.test.ts (US-003, US-004)

| # | Scenario | Category |
|---|----------|----------|
| 1 | User views hook bindings to verify configuration | Walking skeleton |
| 2 | Hook with no matchers displays "(no matchers)" | Focused (edge) |
| 3 | MCP server parsed with name, type, command, args, and env vars | Focused |
| 4 | MCP server with missing command field shows warning | Error |
| 5 | Rules extracted from settings with source annotation | Focused |
| 6 | Plugins extracted from settings | Focused |
| 7 | Malformed JSON returns parse error with message | Error |
| 8 | Missing hooks section returns empty hooks list | Boundary |
| 9 | Missing mcpServers section returns empty servers list | Boundary |

### skill-parser.test.ts (US-005)

| # | Scenario | Category |
|---|----------|----------|
| 1 | Skill parsed with name from filename and description from content | Focused |
| 2 | Skill with heading-based description | Focused |
| 3 | Skill with paragraph-based description | Focused |
| 4 | Empty skill file produces empty description | Boundary |
| 5 | Skill name strips .md extension from filename | Boundary |

### config-aggregator.test.ts (US-001, US-005, US-006, US-007)

| # | Scenario | Category |
|---|----------|----------|
| 1 | User sees all configuration categories from .claude/ directory | Walking skeleton |
| 2 | Missing subdirectories produce empty lists, not errors | Focused (edge) |
| 3 | Per-file read errors isolated from successful reads | Error |
| 4 | Both user and project scopes aggregated with source annotations | Focused |
| 5 | Doc files passed through with scope and path | Focused |
| 6 | Settings parse error does not break agent and skill lists | Error |
| 7 | Completely empty config produces all-empty aggregated result | Boundary |
| 8 | Agents from both scopes combined in aggregated result | Focused |
| 9 | Read errors carry scope annotation | Error |

## Implementation Sequence

Enable one test at a time in this order:

1. `agent-parser.test.ts` -- WS-1 (walking skeleton)
2. `agent-parser.test.ts` -- remaining focused + error scenarios
3. `settings-parser.test.ts` -- WS-2 (walking skeleton)
4. `settings-parser.test.ts` -- remaining focused + error scenarios
5. `skill-parser.test.ts` -- all scenarios
6. `config-aggregator.test.ts` -- WS-3 (walking skeleton)
7. `config-aggregator.test.ts` -- remaining focused + error scenarios

## Mandate Compliance Evidence

### CM-A: Driving Port Usage
All test files import from `src/plugins/norbert-config/domain/` (pure domain functions):
- `agentParser.ts` -- `parseAgentFile`
- `settingsParser.ts` -- `parseSettings`
- `skillParser.ts` -- `parseSkillFile`
- `configAggregator.ts` -- `aggregateConfig`

Zero imports from internal components (views, Rust backend, React).

### CM-B: Business Language Purity
Gherkin-style comments use domain terms: "agent definition", "hook binding", "matcher pattern", "skill description", "configuration category", "scope annotation". Zero technical terms (no HTTP, JSON internals, React, database, API).

### CM-C: Walking Skeleton + Focused Scenario Counts
- Walking skeletons: 3
- Focused scenarios: 26
- Total: 29
- Error/boundary ratio: 45%
