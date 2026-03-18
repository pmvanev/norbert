# Performance Monitor — Evolution Record

**Feature ID**: norbert-performance-monitor
**Delivered**: 2026-03-18
**Paradigm**: Functional
**Crafter**: nw-functional-software-crafter

## Summary

Extends the norbert-usage plugin with a multi-metric, multi-scope monitoring dashboard for Claude Code power users running 2-5 concurrent sessions. Introduces cross-session aggregation, configurable time windows (1m/5m/15m/Session), drill-down navigation (aggregate to session to agent), and context pressure tracking with urgency zones. Preserves full backward compatibility with existing Oscilloscope, Gauge Cluster, and Usage Dashboard views.

The design follows the existing pure-core/effect-shell pattern: all new domain modules are pure functions, effects are confined to the store/adapter layer, and React views are stateless renderers of domain-computed data.

## User Stories Delivered

| ID | Title | MoSCoW |
|----|-------|--------|
| US-PM-001 | Performance Monitor View Registration | Must Have |
| US-PM-002 | Multi-Session Aggregate Metrics | Must Have |
| US-PM-003 | Session Drill-Down Navigation | Must Have |
| US-PM-004 | Configurable Time Window | Must Have |
| US-PM-005 | Context Window Pressure Monitoring | Must Have |
| US-PM-006 | Cost Rate Trending | Must Have |
| US-PM-007 | Oscilloscope Backward Compatibility | Must Have |

## Steps Executed

| Step | Title | Phases | Commit |
|------|-------|--------|--------|
| 01-01 | Domain types and multi-session store | PREPARE, RED_ACCEPTANCE, RED_UNIT, GREEN, COMMIT | `e38f100` |
| 01-02 | View registration and backward compatibility | PREPARE, RED_ACCEPTANCE, RED_UNIT, GREEN, COMMIT | `d2c99f7` |
| 02-01 | Cross-session aggregator pure functions | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `4ee3690` |
| 02-02 | Context pressure tracker pure functions | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `398cc6e` |
| 02-03 | Cost rate computation and aggregate view component | PREPARE, RED_ACCEPTANCE, RED_UNIT, GREEN, COMMIT | `7e61092` |
| 03-01 | Navigation state machine | RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `3b1efb5` |
| 03-02 | Session detail view component | PREPARE, RED_ACCEPTANCE (skipped), RED_UNIT, GREEN, COMMIT | `5728336` |
| 04-01 | Multi-window sampler with downsampling | PREPARE, RED_ACCEPTANCE, RED_UNIT (skipped), GREEN, COMMIT | `a59eb0f` |
| 04-02 | Time window selector UI and integration | PREPARE, RED_ACCEPTANCE, RED_UNIT, GREEN, COMMIT | `e9f18dd` |

Post-delivery commits:

| Commit | Description |
|--------|-------------|
| `feab85f` | L1-L4 quality pass on performance monitor feature |
| `c9dbf24` | Address testing theater defects from adversarial review |

## Key Architectural Decisions

### Pure-core/effect-shell extended for multi-session

All new domain modules (`crossSessionAggregator`, `performanceMonitor`, `multiWindowSampler`, `urgencyThresholds`) are pure functions. The only new mutable state is the `multiSessionStore` adapter, which manages per-session `SessionMetrics` cells and notifies subscribers. This keeps the effect boundary narrow and testable.

### Shared urgency thresholds

Urgency zones (normal < 70%, amber 70-89%, red >= 90%) were extracted from `gaugeCluster.ts` into a shared `urgencyThresholds.ts` module. Both the Gauge Cluster and Performance Monitor consume the same threshold constants, eliminating configuration drift.

### Cross-session aggregation as a single pure function

`Array<SessionMetrics> -> AggregateMetrics` is O(N) where N is active sessions (typically 2-5). The sum invariant (`aggregate.totalTokenRate === sum of per-session rates`) is validated via property-based testing.

### Multi-window ring buffers with fixed capacity

Time windows use ring buffers targeting 300-900 data points: 1m at 600 samples/100ms, 5m at 600/500ms, 15m at 900/1s. Session-length window computes dynamic resolution. No unbounded growth.

### Additive view registration

Performance Monitor is registered as a new view alongside existing views. No existing view registrations are removed or modified. Oscilloscope floating panel configurations continue to work unchanged.

### Rejected simpler alternatives

1. **Aggregate counters in Gauge Cluster** -- covers ~30% of functionality, no drill-down or time windows.
2. **Multi-session toggle in Oscilloscope** -- covers ~50%, but cannot show multiple metrics simultaneously or navigate to agent-level detail.

Both were rejected because the core job-to-be-done (identifying which session is consuming resources and investigating at multiple time scales) requires a multi-metric grid with navigation state.

## Files Created

### Domain (pure functions)
- `src/plugins/norbert-usage/domain/crossSessionAggregator.ts`
- `src/plugins/norbert-usage/domain/performanceMonitor.ts`
- `src/plugins/norbert-usage/domain/multiWindowSampler.ts`
- `src/plugins/norbert-usage/domain/urgencyThresholds.ts`

### Adapters (effect boundary)
- `src/plugins/norbert-usage/adapters/multiSessionStore.ts`
- `src/plugins/norbert-usage/adapters/sessionDiscovery.ts`

### Views (React components)
- `src/plugins/norbert-usage/views/PerformanceMonitorView.tsx`
- `src/plugins/norbert-usage/views/PMAggregateGrid.tsx`
- `src/plugins/norbert-usage/views/PMChart.tsx`
- `src/plugins/norbert-usage/views/PMSessionDetail.tsx`
- `src/plugins/norbert-usage/views/PMTimeWindowSelector.tsx`

## Files Modified

- `src/plugins/norbert-usage/domain/types.ts` -- added 7 new algebraic types (AggregateMetrics, SessionSummary, TimeWindowConfig, PMViewMode, CompactionEstimate, AgentMetrics, SessionDetailData)
- `src/plugins/norbert-usage/domain/gaugeCluster.ts` -- extracted urgency thresholds to shared module
- `src/plugins/norbert-usage/index.ts` -- wired multi-session store initialization and PM view registration
- `src/plugins/norbert-usage/hookProcessor.ts` -- updated routing to support session_id attribution (implied by architecture)

## Test Coverage Summary

**29 test files, 251 tests passing** (2.85s execution)

### Acceptance tests (5 suites)
- `cross-session-aggregation.test.ts` -- 10 scenarios including property-based sum invariant
- `context-pressure.test.ts` -- 13 scenarios covering urgency zones, boundary values, compaction estimates
- `session-drill-down.test.ts` -- 9 scenarios covering navigation state, breadcrumbs, frozen sessions
- `backward-compatibility.test.ts` -- 4 scenarios verifying oscilloscope data pipeline unchanged
- `time-window.test.ts` -- 11 scenarios covering presets, dynamic resolution, buffer wrapping, navigation persistence

### Unit tests (new)
- `crossSessionAggregator.test.ts` -- aggregator invariants and edge cases
- `performanceMonitor.test.ts` -- cost rate, urgency classification, compaction estimate
- `multiSessionStore.test.ts` -- session lifecycle tracking
- `sessionDiscovery.test.ts` -- active session queries
- `PMSessionDetail.test.ts` -- component rendering, agent breakdown, graceful degradation
- `PMTimeWindowSelector.test.ts` -- selector rendering, selection state, callbacks

### Unit test skips (justified)
Steps 02-01, 02-02, 03-01, and 04-01 skipped RED_UNIT phase where acceptance tests already exercised pure domain functions at the driving port boundary. Separate unit tests would have duplicated coverage without adding defect-detection value.

## Lessons Learned / Review Findings

### Adversarial review findings (commit `c9dbf24`)
A post-delivery adversarial review identified testing theater defects -- tests that appeared to validate behavior but had structural weaknesses. Fixes applied:
- Strengthened assertions that were too loose to catch regressions
- Ensured test names accurately described what was being validated
- Tightened coupling between test setup and assertion to reduce false-pass risk

### L1-L4 quality pass (commit `feab85f`)
A structured quality pass across all 4 levels (L1: syntax/style, L2: domain correctness, L3: integration, L4: resilience) produced refactoring improvements without changing external behavior.

### Shared threshold extraction
Moving urgency thresholds from `gaugeCluster.ts` to `urgencyThresholds.ts` was not in the original plan but emerged as a necessary step when both Gauge Cluster and Performance Monitor needed identical threshold values. This reduced the risk of configuration drift and simplified future threshold changes.

### RED_UNIT phase skipping
Several steps skipped the RED_UNIT phase where acceptance tests already covered the domain functions being implemented. This saved time without reducing defect detection. The justification was recorded in each execution log entry for traceability.

## Statistics

- **Total source lines added**: ~3,246 (net, across 27 files)
- **New source files**: 11
- **Modified source files**: 4
- **New test files**: 11
- **Delivery phases**: 4 (Foundation, Aggregate Metrics, Drill-Down Navigation, Time Windows)
- **Delivery steps**: 9
- **No new external dependencies** -- all capabilities use browser APIs and extend existing patterns
