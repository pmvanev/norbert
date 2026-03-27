# Evolution Archive: OTel-First Metrics Pipeline

## Feature Summary

Migrated metrics aggregation from hook-first to OTel-first data sourcing. Introduced dual dispatch tables (hook and OTel), cost suppression when OTel is active, API error tracking, improved tool tracking via OTel tool_result events, OTel session timing preference, and a source-agnostic data health indicator replacing the hook-specific hookHealth.

## Stories Delivered

| Story | Title | Description |
|-------|-------|-------------|
| US-OFM-01 | Cost single source of truth | Suppress hook cost/token accumulation when OTel is active; OTel dispatch table uses identity handlers for prompt_submit, tool_call_start, tool_call_end, and cost-only agent_complete fields |
| US-OFM-02 | Rich tool tracking from OTel | tool_result events increment toolCallCount in OTel mode; tool_call_start remains identity for OTel sessions while hook-only sessions retain existing behavior |
| US-OFM-03 | API error visibility | apiErrorCount, apiRequestCount, and derived apiErrorRate tracked in both hook and OTel dispatch tables |
| US-OFM-04 | Source-agnostic data health | dataHealth ("healthy", "degraded", "no-data") replaces hookHealth with recency-based detection using totalEventCount, lastEventAt, and stalenessThresholdMs |
| US-OFM-05 | OTel session timing preference | api_request sets sessionStartedAt when empty in OTel mode, ensuring earliest meaningful OTel timestamp wins |

## Architecture Decisions

| ADR | Decision | Alternatives Rejected |
|-----|----------|----------------------|
| ADR-044 | isOtelActive as explicit boolean parameter to aggregateEvent (default false for backward compatibility) | Implicit detection from event source; global config flag |
| ADR-045 | Dual dispatch table -- hookEventHandlers and otelEventHandlers as separate handler maps | Single table with conditional branches; runtime strategy pattern |
| ADR-046 | dataHealth replaces hookHealth with recency-based detection from any event source | Keep hookHealth and add separate otelHealth; composite health score |

## Implementation Steps

| Step | Title | Key Files Modified | Commit |
|------|-------|--------------------|--------|
| 02-01 | Dual dispatch table with OTel cost suppression | metricsAggregator.ts, metricsAggregator.test.ts | bff3f20 |
| 03-01 | API error and request count tracking | metricsAggregator.ts, metricsAggregator.test.ts | a511c67 |
| 04-01 | Wire tool_result to increment toolCallCount | metricsAggregator.ts | dc1e6da |
| 05-01 | OTel session timing preference | metricsAggregator.ts, metricsAggregator.test.ts | 6c103b4 |
| 06-01 | Source-agnostic dataHealth indicator | gaugeCluster.ts, dashboard.ts, GaugeClusterView.tsx, UsageDashboardView.tsx | 0e8aabd |
| L1-L4 | Refactoring pass | GaugeClusterView.tsx, UsageDashboardView.tsx, test files | d19c8e0 |

## Quality Gates Passed

| Gate | Result | Details |
|------|--------|---------|
| TDD steps | 6/6 COMMIT/PASS | Steps 02-01 through 06-01 plus L1-L4 refactoring |
| Adversarial review round 1 | Findings D1-D6 addressed | D5 accepted as-is; D1, D2, D3, D4, D6 fixed (852bf06) |
| Adversarial review round 2 | Findings D1-D4 addressed | hookProcessor OTel wiring, test naming, JSDoc, extractCostUsd guards (08090d0) |
| Mutation testing | 85.5% kill rate | Domain files targeted; threshold 80% (0d627a8) |
| DES integrity | Verified | All 6 implementation steps traced to commits |

## Key Metrics

| Metric | Value |
|--------|-------|
| Production files modified | 7 (metricsAggregator.ts, gaugeCluster.ts, dashboard.ts, types.ts, hookProcessor.ts, GaugeClusterView.tsx, UsageDashboardView.tsx) |
| Test files modified | 10+ (unit, acceptance, and smoke layers) |
| Test count covering feature | ~140 tests |
| Acceptance tests (DISTILL) | 34 tests across 30 Gherkin scenarios |
| Net lines changed | +859 / -186 across 18 files |

## Known Limitations

- Per-tool breakdown (success rate, duration per tool) deferred to future feature; US-OFM-02 covers aggregate toolCallCount only
- hookProcessor.ts adapter code has pre-existing low mutation coverage (59%); not addressed in this feature scope
- Transcript polling deprecation path identified but not implemented; OTel-active sessions still receive transcript events
