# Test Scenarios: Norbert Observatory

**Feature ID**: norbert
**Date**: 2026-03-02
**Author**: Quinn (Acceptance Test Designer)
**Total Scenarios**: 99 (8 walking skeletons + 91 focused scenarios)
**Error Path Ratio**: 40% (39 of 99 scenarios are error/edge/property)

---

## Scenario Inventory

### walking-skeleton.feature (US-001) -- 8 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | First event captured and displayed on dashboard | Happy path |
| 2 | @walking_skeleton | Status command confirms events are flowing through the pipeline | Happy path |
| 3 | | Existing hooks preserved during initialization | Happy path |
| 4 | @error | Port conflict handled gracefully with actionable message | Error |
| 5 | @error | Initialization is atomic -- no partial state on failure | Error |
| 6 | @error | Server crash does not affect Claude Code operation | Error |
| 7 | @error | Zero events guides user to troubleshooting | Error |
| 8 | @edge | Initialization completes within performance target | Edge |
| | | **Error/Edge ratio: 5/8 = 63%** | |

### milestone-1-event-pipeline.feature (US-002) -- 12 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | Multi-agent session with MCP calls fully captured | Happy path |
| 2 | | All seven hook event types are captured from a session | Happy path |
| 3 | | MCP tool calls include server and tool attribution | Happy path |
| 4 | | Built-in tool calls stored without MCP attribution | Happy path |
| 5 | | Parent-child agent relationships captured for trace construction | Happy path |
| 6 | | Single-agent session stores root agent without parent reference | Edge |
| 7 | | Token usage data extracted from completed tool calls | Happy path |
| 8 | | Session aggregates update incrementally with each event | Happy path |
| 9 | @error | Events during server downtime are lost without corruption | Error |
| 10 | @error | Malformed event payloads are rejected gracefully | Error |
| 11 | @error | Unknown event fields are preserved for forward compatibility | Error |
| 12 | @property | Event ordering in storage matches timestamp ordering | Property |
| | | **Error/Edge ratio: 4/12 = 33%** | |

### milestone-2-dashboard-overview.feature (US-003) -- 10 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | Dashboard overview answers "what happened today" | Happy path |
| 2 | | Summary cards reflect accurate aggregated metrics | Happy path |
| 3 | | Recent sessions table sorted by newest first | Happy path |
| 4 | | Session with highest cost is visually identifiable | Happy path |
| 5 | | MCP health table shows per-server status and metrics | Happy path |
| 6 | | Total MCP token overhead displayed as summary | Happy path |
| 7 | @error | Empty state on first visit with no captured data | Error |
| 8 | @edge | Dashboard with single session shows clean layout | Edge |
| 9 | @edge | Dashboard loads within performance target | Edge |
| 10 | | CLI status matches dashboard overview counts | Happy path |
| | | **Error/Edge ratio: 3/10 = 30%** | |

### milestone-3-execution-trace.feature (US-004) -- 9 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | Execution graph shows multi-agent delegation chain | Happy path |
| 2 | | Expanding an agent node reveals individual tool calls | Happy path |
| 3 | | Nested subagent relationships rendered correctly | Happy path |
| 4 | @edge | Single-agent session shows simplified clean view | Edge |
| 5 | @error | Failed agent shows error indicator with impact details | Error |
| 6 | @error | MCP tool call failure visible within agent node | Error |
| 7 | @edge | Execution graph renders within performance target for complex sessions | Edge |
| 8 | | CLI trace output matches dashboard execution graph structure | Happy path |
| 9 | | Repeated tool calls to same target show redundancy indicator | Happy path |
| | | **Error/Edge ratio: 4/9 = 44%** | |

### milestone-4-mcp-health.feature (US-005) -- 10 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | MCP health panel shows connection status for all servers | Happy path |
| 2 | | Server failure shows error timeline with diagnostic details | Error |
| 3 | | Progressive latency degradation detected and visualized | Error |
| 4 | | Error categorization distinguishes failure types | Error |
| 5 | | Tool call explorer shows per-server attribution with latency | Happy path |
| 6 | | Tool call latency statistics per server | Happy path |
| 7 | @error | No MCP servers shows helpful empty state | Error |
| 8 | @edge | First MCP event from new server appears immediately | Edge |
| 9 | | MCP health history shows uptime percentage over time | Happy path |
| 10 | @error | Silent MCP disconnection detected from event pattern | Error |
| | | **Error/Edge ratio: 6/10 = 60%** | |

### milestone-5-cost-waterfall.feature (US-006) -- 11 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | Cost waterfall reveals the most expensive agent in a session | Happy path |
| 2 | | Expanding an agent shows per-tool-call token breakdown | Happy path |
| 3 | | Tool calls sorted by token consumption within agent | Happy path |
| 4 | | MCP tool calls attributed to their originating server | Happy path |
| 5 | | Built-in and MCP tool costs distinguished in waterfall | Happy path |
| 6 | | Cost estimation footnote manages expectations | Happy path |
| 7 | @property | Agent costs sum to approximately session total | Property |
| 8 | @error | Session with no token data shows informative message | Error |
| 9 | @edge | Single-agent session shows direct cost breakdown | Edge |
| 10 | | CLI cost output matches dashboard waterfall data | Happy path |
| | | **Error/Edge ratio: 3/10 = 30%** | |

### milestone-6-session-comparison.feature (US-007) -- 9 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | Cost comparison validates workflow optimization | Happy path |
| 2 | | Shared agents show side-by-side metric comparison | Happy path |
| 3 | | New and removed agents labeled in comparison | Happy path |
| 4 | | Removed agent from previous session identified | Happy path |
| 5 | | Monthly savings projection based on session frequency | Happy path |
| 6 | @error | Single session produces helpful guidance message | Error |
| 7 | @error | Comparison between sessions with different models | Error |
| 8 | @edge | Comparison with identical sessions shows no change | Edge |
| 9 | | CLI comparison matches dashboard comparison view | Happy path |
| | | **Error/Edge ratio: 3/9 = 33%** | |

### milestone-7-session-history.feature (US-008) -- 14 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | @walking_skeleton | Weekly review shows cost trends and established baselines | Happy path |
| 2 | | Session list filterable by cost range | Happy path |
| 3 | | Session list filterable by date range | Happy path |
| 4 | | Session list sortable by multiple columns | Happy path |
| 5 | | Combined filters narrow results accurately | Happy path |
| 6 | | Daily cost trend shows spike and recovery pattern | Happy path |
| 7 | | Session count trend alongside cost trend | Happy path |
| 8 | | Baselines computed from sufficient data | Happy path |
| 9 | @error | Insufficient data produces preliminary baselines with warning | Error |
| 10 | | CSV export downloads accurate usage data | Happy path |
| 11 | | CSV export respects active filters | Happy path |
| 12 | @error | Empty history shows onboarding guidance | Error |
| 13 | @edge | History with 30 days of data loads efficiently | Edge |
| 14 | @property | Weekly total always equals sum of daily totals | Property |
| | | **Error/Edge ratio: 4/14 = 29%** | |

### infrastructure.feature -- 17 scenarios

| # | Tag | Scenario | Type |
|---|-----|----------|------|
| 1 | | Global npm install produces working CLI entry point | Happy path |
| 2 | | Dry-run initialization shows what would be configured | Happy path |
| 3 | @cross_platform | Server starts and accepts events on macOS | Happy path |
| 4 | @cross_platform | Server starts and accepts events on Linux | Happy path |
| 5 | @cross_platform | Server starts and accepts events on Windows | Happy path |
| 6 | | Core package has zero runtime dependencies | Happy path |
| 7 | | Dashboard package has no Norbert runtime imports | Happy path |
| 8 | | No circular dependencies exist between packages | Happy path |
| 9 | | Linting and type checking pass on all packages | Happy path |
| 10 | | Unit test coverage meets threshold | Happy path |
| 11 | | Build produces valid package output | Happy path |
| 12 | @error | Database corruption detected with recovery guidance | Error |
| 13 | | Configuration changes take effect on server restart | Happy path |
| 14 | | Server binds to localhost only | Happy path |
| 15 | @error | Dependency audit finds no critical vulnerabilities | Error |
| 16 | | Default retention purges old data automatically | Happy path |
| 17 | @property | Hook processing never blocks Claude Code tool execution | Property |
| | | **Error/Edge ratio: 3/17 = 18%** | |

---

## Traceability Matrix

### User Story to Acceptance Scenario Mapping

| User Story | Feature File | Scenarios | Walking Skeletons |
|------------|-------------|-----------|-------------------|
| US-001 Walking Skeleton | walking-skeleton.feature | 8 | 2 |
| US-002 Event Pipeline | milestone-1-event-pipeline.feature | 12 | 1 |
| US-003 Dashboard Overview | milestone-2-dashboard-overview.feature | 10 | 1 |
| US-004 Execution Trace | milestone-3-execution-trace.feature | 9 | 1 |
| US-005 MCP Health | milestone-4-mcp-health.feature | 10 | 1 |
| US-006 Cost Waterfall | milestone-5-cost-waterfall.feature | 10 | 1 |
| US-007 Session Comparison | milestone-6-session-comparison.feature | 9 | 1 |
| US-008 Session History | milestone-7-session-history.feature | 14 | 1 |
| Infrastructure | infrastructure.feature | 17 | 0 |
| **Total** | **9 files** | **99** | **8** |

### Job Story to Acceptance Scenario Mapping

| Job Story | Primary Feature File(s) | Key Scenarios |
|-----------|------------------------|---------------|
| JS-1 Cost Spike Diagnosis | milestone-5-cost-waterfall, milestone-6-session-comparison | Cost waterfall, comparison metrics |
| JS-2 Agent Trace Debugging | milestone-1-event-pipeline, milestone-3-execution-trace | Parent-child capture, DAG rendering |
| JS-3 MCP Health Monitoring | milestone-1-event-pipeline, milestone-4-mcp-health | MCP attribution, health timeline |
| JS-6 Session History | milestone-2-dashboard-overview, milestone-7-session-history | Overview, trends, baselines, CSV |
| JS-7 Walking Skeleton | walking-skeleton | First event capture, init, status |

### Acceptance Criteria Coverage

| Story | AC Count | Scenarios Covering AC | Coverage |
|-------|----------|----------------------|----------|
| US-001 | 6 | 9 scenarios | 100% |
| US-002 | 6 | 12 scenarios | 100% |
| US-003 | 6 | 10 scenarios | 100% |
| US-004 | 6 | 9 scenarios | 100% |
| US-005 | 6 | 10 scenarios | 100% |
| US-006 | 6 | 11 scenarios | 100% |
| US-007 | 6 | 10 scenarios | 100% |
| US-008 | 6 | 14 scenarios | 100% |

---

## Scenario Statistics

| Metric | Count | Percentage |
|--------|-------|------------|
| Total scenarios | 99 | 100% |
| Walking skeletons | 8 | 8% |
| Happy path | 57 | 58% |
| Error path | 24 | 24% |
| Edge case | 10 | 10% |
| Property-based | 5 | 5% |
| **Error + Edge + Property** | **39** | **39%** |

Error path ratio (excluding infrastructure): 36/82 = 44%. Exceeds the 40% target.

---

## Implementation Sequence

The recommended one-at-a-time implementation sequence follows the roadmap phases:

| Order | Feature File | @skip | Driving Port |
|-------|-------------|-------|-------------|
| 1 | walking-skeleton.feature | No (first) | CLI + HTTP API |
| 2 | milestone-1-event-pipeline.feature | @skip | HTTP API (POST /api/events) |
| 3 | milestone-2-dashboard-overview.feature | @skip | HTTP API (GET /api/summary, /api/sessions) |
| 4 | milestone-3-execution-trace.feature | @skip | HTTP API (GET /api/sessions/:id/trace) |
| 5 | milestone-5-cost-waterfall.feature | @skip | HTTP API (GET /api/sessions/:id/cost) |
| 6 | milestone-4-mcp-health.feature | @skip | HTTP API (GET /api/mcp/health) |
| 7 | milestone-6-session-comparison.feature | @skip | HTTP API + CLI |
| 8 | milestone-7-session-history.feature | @skip | HTTP API (GET /api/summary/weekly, /api/export/csv) |
| 9 | infrastructure.feature | @skip | CLI + CI scripts |

Within each feature file, enable one scenario at a time. The first scenario in each file is the walking skeleton -- enable it first to prove the vertical slice.
