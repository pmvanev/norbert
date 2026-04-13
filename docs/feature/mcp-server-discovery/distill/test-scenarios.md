# Test Scenarios: MCP Server Discovery

## Scenario Summary

| File | Walking Skeletons | Happy Path | Error Path | Edge Case | Property | Total |
|------|:-:|:-:|:-:|:-:|:-:|:-:|
| walking-skeleton.feature | 3 | - | - | - | - | 3 |
| milestone-1-rust-backend.feature | - | 4 | 4 | 2 | - | 10 |
| milestone-2-domain-aggregation.feature | - | 6 | 4 | 3 | 1 | 14 |
| milestone-3-view-attribution.feature | - | 4 | 2 | 2 | - | 8 |
| **Total** | **3** | **14** | **10** | **7** | **1** | **35** |

## Error Path Ratio

Error + edge scenarios: 17 / 35 = 49% (exceeds 40% target)

## Milestone-to-Roadmap Mapping

| Milestone | Roadmap Step | Driving Port |
|-----------|-------------|--------------|
| 1: Rust backend | 01-01: Add mcp_files field | `read_claude_config()` IPC command |
| 2: Domain aggregation | 02-01: Aggregate mcp files | `aggregateConfig(rawConfig)` |
| 3: View attribution | 03-01: Display source origin | React view layer (McpTab) |

## Acceptance Criteria Coverage

### Roadmap Step 01-01
- [x] ClaudeConfig includes mcp_files field -- milestone-1 scenarios 1-4
- [x] User scope reads ~/.claude.json -- milestone-1 scenario 1
- [x] Project scope reads .mcp.json -- milestone-1 scenario 2
- [x] Plugin scan reads .mcp.json -- milestone-1 scenario 3
- [x] merge_configs concatenates mcp_files -- milestone-1 scenario 4
- [x] Missing files produce empty results -- milestone-1 scenarios 5-7
- [x] Malformed JSON error handling -- milestone-1 scenario 9

### Roadmap Step 02-01
- [x] McpServerConfig includes source field -- milestone-2 scenarios 1-3
- [x] MCP servers from all sources aggregated -- milestone-2 scenario 4
- [x] Correct scope and source attribution -- milestone-2 scenarios 1-3
- [x] Empty/missing/malformed files produce no crash -- milestone-2 scenarios 7-8
- [x] Reuses extractMcpServers -- verified by testing through aggregateConfig

### Roadmap Step 03-01
- [x] Server cards show source origin -- milestone-3 scenarios 1-2
- [x] All sources render without layout issues -- milestone-3 scenario 3
- [x] Empty state updated -- milestone-3 scenario 7

## Implementation Sequence (One-at-a-Time)

1. walking-skeleton.feature: WS-1 (remove @walking_skeleton skip)
2. walking-skeleton.feature: WS-2
3. walking-skeleton.feature: WS-3
4. milestone-1: Scenarios 1 through 10 (one at a time)
5. milestone-2: Scenarios 1 through 14 (one at a time)
6. milestone-3: Scenarios 1 through 8 (one at a time)

## Mandate Compliance Evidence

### CM-A: Hexagonal Boundary Enforcement
- Milestone 1 tests invoke through `read_claude_config()` IPC command (driving port)
- Milestone 2 tests invoke through `aggregateConfig()` (driving port)
- Milestone 3 tests invoke through React view rendering (driving port)
- No internal components tested directly (no direct calls to `extractMcpServers`, `safeParseJson`, etc.)

### CM-B: Business Language Purity
- Zero technical terms in Gherkin (no JSON, HTTP, API, database, IPC, struct, vec)
- Business terms used: MCP server, configuration, scope, source, server card, empty state, warning
- Step methods will delegate to production services (configAggregator, settingsParser)

### CM-C: Walking Skeleton + Focused Scenario Counts
- Walking skeletons: 3 (user value E2E)
- Focused scenarios: 32 (boundary tests with test doubles for filesystem)
- Ratio: 3 skeletons / 32 focused -- within recommended range
