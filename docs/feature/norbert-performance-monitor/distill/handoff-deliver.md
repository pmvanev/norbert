# DELIVER Wave Handoff: norbert-performance-monitor

## Handoff Summary

**Feature:** Performance Monitor -- acceptance test suite for multi-metric, multi-scope monitoring dashboard
**From:** DISTILL wave (acceptance-designer)
**To:** DELIVER wave (software-crafter)
**Date:** 2026-03-18

---

## Test Suite Summary

| File | Capability | Stories | Tests | Walking Skeletons |
|------|-----------|---------|-------|-------------------|
| cross-session-aggregation.test.ts | Aggregate metrics + cost rate | US-PM-001, US-PM-002, US-PM-006 | 11 | 2 |
| context-pressure.test.ts | Context window pressure | US-PM-005 | 13 | 1 |
| session-drill-down.test.ts | Session drill-down navigation | US-PM-003 | 10 | 1 |
| time-window.test.ts | Configurable time windows | US-PM-004 | 10 | 1 |
| backward-compatibility.test.ts | Oscilloscope coexistence | US-PM-007 | 4 | 0 |
| **Total** | | **All 7 stories** | **48** | **5** |

## Scenario Breakdown

- Walking skeletons: 5 (10%)
- Happy path focused: 16 (33%)
- Error/boundary scenarios: 25 (52%)
- Property-shaped: 2 (4%)

Error path ratio: 52% (target >= 40%) -- PASS

## Implementation Sequence

All tests use `describe.skip`. Enable one at a time, implement, commit, repeat.

### Phase A: Foundation (US-PM-001, US-PM-007)
1. `cross-session-aggregation.test.ts` -- "Empty aggregate when no sessions are active"
2. `cross-session-aggregation.test.ts` -- "Single session aggregate equals that session's metrics"
3. `backward-compatibility.test.ts` -- "Existing time-series buffer operations produce unchanged results"

### Phase B: Core Metrics (US-PM-002, US-PM-005, US-PM-006)
4. `cross-session-aggregation.test.ts` -- "User views aggregate resource consumption across all active sessions" (walking skeleton)
5. `cross-session-aggregation.test.ts` -- "Aggregate token rate is the sum of per-session burn rates"
6. `cross-session-aggregation.test.ts` -- "Aggregate active agents is the sum of per-session agent counts"
7. `cross-session-aggregation.test.ts` -- "Per-session breakdown is sorted by token rate descending"
8. `cross-session-aggregation.test.ts` -- "User sees rolling cost rate across all active sessions" (walking skeleton)
9. `cross-session-aggregation.test.ts` -- "Zero cost rate when all sessions are idle"
10. `cross-session-aggregation.test.ts` -- "Aggregate updates when a new session is added"
11. `cross-session-aggregation.test.ts` -- "Aggregate updates when a session ends"
12. `context-pressure.test.ts` -- "User sees context utilization with urgency zones and compaction estimate" (walking skeleton)
13. `context-pressure.test.ts` -- "Context below 70% shows normal urgency"
14. `context-pressure.test.ts` -- "Context at 70% triggers amber urgency zone"
15. `context-pressure.test.ts` -- "Context at 72% is within amber urgency zone"
16. `context-pressure.test.ts` -- "Context at 90% triggers red urgency zone"
17. `context-pressure.test.ts` -- "Context at 93% is deep in red urgency zone"
18. `context-pressure.test.ts` -- "Context at 69% is the last normal level before amber"
19. `context-pressure.test.ts` -- "Context at 89% is the last amber level before red"
20. `context-pressure.test.ts` -- "Context at 100% is in red urgency zone"
21. `context-pressure.test.ts` -- "Compaction estimate calculated from remaining headroom and burn rate"
22. `context-pressure.test.ts` -- "Compaction estimate shows low confidence when burn rate near zero"
23. `context-pressure.test.ts` -- "Context data unavailable produces safe default values"
24. `context-pressure.test.ts` -- "@property: context urgency thresholds match Gauge Cluster thresholds"
25. `cross-session-aggregation.test.ts` -- "@property: aggregate total always equals sum of per-session values"

### Phase C: Navigation (US-PM-003)
26. `session-drill-down.test.ts` -- "Aggregate view mode is the default"
27. `session-drill-down.test.ts` -- "Session detail view mode captures the selected session"
28. `session-drill-down.test.ts` -- "User drills into a session to investigate a token rate spike" (walking skeleton)
29. `session-drill-down.test.ts` -- "Breadcrumb reflects current navigation path"
30. `session-drill-down.test.ts` -- "Session detail includes agent breakdown when agent data is available"
31. `session-drill-down.test.ts` -- "Session detail degrades gracefully when agent data is absent"
32. `session-drill-down.test.ts` -- "Navigation back from detail to aggregate preserves time window"
33. `session-drill-down.test.ts` -- "Session end during detail view produces frozen state indicator"
34. `session-drill-down.test.ts` -- "Ended session removed from aggregate after back navigation"

### Phase D: Time Windows (US-PM-004)
35. `time-window.test.ts` -- "Time window presets have correct resolution and capacity"
36. `time-window.test.ts` -- "User switches from 1-minute to 15-minute window to see resource trend" (walking skeleton)
37. `time-window.test.ts` -- "Session-length window computes dynamic resolution for full history"
38. `time-window.test.ts` -- "Stats computed from 5-minute window differ from 1-minute window"
39. `time-window.test.ts` -- "Time window selection is independent of view mode"
40. `time-window.test.ts` -- "1-minute window buffer at capacity wraps correctly"
41. `time-window.test.ts` -- "Partially filled window still produces valid stats"

### Phase Final: Backward Compatibility Validation
42-44. Remaining backward-compatibility.test.ts scenarios

---

## Driving Ports (Target Domain Functions)

New modules to implement (all pure functions):

| Module | Key Functions | Tests Driven By |
|--------|--------------|-----------------|
| `domain/crossSessionAggregator.ts` | `aggregateAcrossSessions` | cross-session-aggregation.test.ts |
| `domain/performanceMonitor.ts` | `classifyContextUrgency`, `computeCompactionEstimate`, `computeSessionDetailData`, `computeBreadcrumb`, `computeCostRatePerMinute`, `createAggregateViewMode`, `createSessionDetailViewMode` | context-pressure.test.ts, session-drill-down.test.ts |
| `domain/multiWindowSampler.ts` | `createMultiWindowBuffer`, `appendMultiWindowSample`, `getActiveWindowSamples`, `computeMultiWindowStats`, `resolveSessionWindowConfig`, `TIME_WINDOW_PRESETS` | time-window.test.ts |
| `domain/urgencyThresholds.ts` | `CONTEXT_AMBER_THRESHOLD`, `CONTEXT_RED_THRESHOLD` | context-pressure.test.ts |

Existing modules reused unchanged:
- `domain/timeSeriesSampler.ts` -- ring buffer operations
- `domain/metricsAggregator.ts` -- per-session fold, `createInitialMetrics`
- `domain/oscilloscope.ts` -- waveform rendering functions
- `domain/gaugeCluster.ts` -- threshold comparison target

---

## Mandate Compliance Evidence

### CM-A: Hexagonal Boundary Enforcement
All test files import from driving ports only:
- `metricsAggregator` (existing, for `createInitialMetrics` helper)
- `timeSeriesSampler` (existing, for buffer operations)
- Target imports (commented): `crossSessionAggregator`, `performanceMonitor`, `multiWindowSampler`, `urgencyThresholds`

Zero internal component imports. No adapter or view imports.

### CM-B: Business Language Purity
Domain terms used: session, token rate, cost rate, context pressure, urgency, compaction, aggregate, breakdown, time window, burn rate, agent.

Zero technical terms: no HTTP, API, JSON, database, SQL, React, component, render, state, hook, callback, DOM, canvas.

### CM-C: Walking Skeleton + Focused Scenario Counts
- Walking skeletons: 5 (user-centric, demo-able to stakeholders)
- Focused scenarios: 43 (boundary tests exercising driving ports)
- Ratio: 10% skeletons, 90% focused -- within recommended range

---

## Peer Review

### Review Summary (critique-dimensions, 6 dimensions)

| Dimension | Status | Notes |
|-----------|--------|-------|
| Happy Path Bias | PASS | 52% error/boundary scenarios (target >= 40%) |
| GWT Format Compliance | PASS | All tests use Given-When-Then comments, single When per test |
| Business Language Purity | PASS | Zero technical terms in test descriptions or comments |
| Coverage Completeness | PASS | All 7 user stories covered, all AC addressed |
| Walking Skeleton User-Centricity | PASS | All 5 skeletons titled from user goal perspective |
| Priority Validation | PASS | Implementation order follows dependency graph and opportunity scores |

**Approval Status:** APPROVED

---

## Notes for Software-Crafter

1. **Functional programming paradigm**: All new domain modules must be pure functions. Follow existing patterns in `oscilloscope.ts`, `gaugeCluster.ts`, `metricsAggregator.ts`.

2. **Test code is commented out**: Each test has the assertions commented with target function signatures. Uncomment imports and assertions as you implement each function.

3. **Shared threshold configuration**: `urgencyThresholds.ts` must export the same values currently hardcoded in `gaugeCluster.ts` (`DEFAULT_THRESHOLDS`). Modify `gaugeCluster.ts` to import from the shared module.

4. **Property-shaped tests** (tagged `@property` in describe name): Implement as property-based tests with generators, not single-example assertions. Use fast-check or similar.

5. **Mutation testing**: Per `CLAUDE.md`, this project uses per-feature mutation testing. Run mutation tests against the new domain modules once implemented.
