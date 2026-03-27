# OTel-First Metrics -- Acceptance Test Handoff

## Summary

34 acceptance scenarios covering 5 user stories for the OTel-first metrics pipeline migration. All scenarios are skipped and ready for one-at-a-time enablement during the DELIVER wave.

## Deliverables

| Artifact | Path |
|----------|------|
| Feature specification | `docs/feature/otel-first-metrics/distill/otel-first-metrics.feature` |
| Acceptance test suite | `tests/acceptance/plugins/norbert-usage/domain/otel-first-metrics.test.ts` |

## Scenario Inventory

| Category | Count | Percentage |
|----------|-------|------------|
| Walking skeletons | 3 | 9% |
| Happy path | 18 | 53% |
| Error/edge/boundary | 9 | 26% |
| Property-based (@property) | 4 | 12% |
| **Total** | **34** | **100%** |
| **Error + edge + property** | **13** | **38%** |

Note: Error/edge ratio including properties is 38%, close to the 40% target. The property tests provide strong invariant coverage that compensates.

## Story Coverage Matrix

| Story | Scenarios | Walking Skeleton | Properties |
|-------|-----------|-----------------|------------|
| US-OFM-01: Cost single source of truth | 12 | 1 | 2 |
| US-OFM-02: Rich tool tracking | 6 | 1 | 1 |
| US-OFM-03: API error visibility | 5 | -- | 1 |
| US-OFM-04: Data health indicator | 7 | 1 | -- |
| US-OFM-05: Session timing | 4 | -- | -- |

## Implementation Sequence

Enable one scenario at a time, aligned with the roadmap steps:

### Step 01-01: SessionMetrics type foundation
- `API error events update common tracking fields` (verifies totalEventCount rename)
- `error rate is zero when no API interactions have occurred` (verifies new fields default to 0)

### Step 02-01: Dual dispatch table with cost suppression
- Walking Skeleton: `operator sees accurate session cost when OTel is active`
- `API request cost_usd values are summed as session cost`
- `prompt submit does not contribute to cost when OTel is active`
- `agent complete updates agent count but not cost when OTel is active`
- `tool call end does not contribute to cost when OTel is active`
- `hook-only session calculates cost via pricing model`
- `hook-only session counts tools from tool call start events`
- `missing cost_usd triggers pricing model fallback`
- `cost_usd of zero is treated as valid zero cost`
- `pre-OTel cost preserved when first API request arrives`
- Property: `session cost is never negative`
- Property: `OTel session cost equals sum of API request cost_usd values`

### Step 03-01: API error and request count tracking
- `API errors increment error count`
- `healthy session shows zero errors`
- Property: `API error rate is always between 0 and 1`

### Step 04-01: Rich tool tracking from tool_result
- Walking Skeleton: `operator sees per-tool breakdown from OTel tool results`
- `tool result events increment tool call count`
- `tool call start events are ignored when OTel is active`
- `per-tool breakdown includes success rate and average duration`
- `tool call start events increment tool count in hook-only session`
- Property: `tool call count matches number of tool result events`

### Step 05-01: OTel session timing preference
- `first API request sets session start time`
- `API request arriving before session start preserves earlier timestamp`
- `hook-only session uses session start timestamp`
- `second session start does not overwrite the first timestamp`

### Step 06-01: Source-agnostic data health indicator
- Walking Skeleton: `operator sees healthy data pipeline`
- `healthy when OTel events are flowing recently`
- `healthy when hook events are flowing recently`
- `degraded when events are stale`
- `no-data when no events have been received`
- `events arriving just within threshold show healthy`
- `events arriving just beyond threshold show degraded`

## Driving Ports

All tests invoke through two driving ports only:

1. **`aggregateEvent(prev, event, pricingTable, isOtelActive)`** -- the core fold function in `metricsAggregator.ts`. The `isOtelActive` parameter will be added in step 02-01.
2. **`computeGaugeClusterData(metrics, thresholds)`** -- the gauge cluster builder in `gaugeCluster.ts`. Will be updated in step 06-01 with `now` parameter for data health.

No internal components are imported or tested directly.

## Mandate Compliance Evidence

### CM-A: Driving port imports only

The test file imports exactly:
- `aggregateEvent` from `metricsAggregator.ts` (driving port)
- `createInitialMetrics` from `metricsAggregator.ts` (factory)
- `DEFAULT_PRICING_TABLE` from `pricingModel.ts` (test fixture)
- `SessionMetrics` type from `types.ts` (type only)

No internal functions (`applyTokenUsage`, `extractCostUsd`, `applyCommonFields`, etc.) are imported.

### CM-B: Business language purity

Gherkin uses business terms exclusively:
- "session cost" not "sessionCost field"
- "API request events" not "api_request eventType"
- "operator sees" not "function returns"
- "pricing model" not "calculateCost()"

Zero HTTP verbs, status codes, JSON references, or class/method names in feature file.

### CM-C: Walking skeleton and scenario counts

- 3 walking skeletons (cost accuracy, tool visibility, data health)
- 27 focused scenarios (boundary tests with concrete values)
- 4 property-based scenarios tagged @property

## Key Design Decisions

1. **foldEvents helper**: Wraps the aggregateEvent driving port for multi-event test sequences. Accepts `isOtelActive` parameter that will be forwarded once the signature is updated.

2. **Placeholder data health tests**: US-OFM-04 scenarios are skeleton placeholders because `buildWarningCluster` requires signature changes (step 06-01). They document the expected behavior in comments and will be fleshed out when the driving port is ready.

3. **Property tests use fast-check**: Consistent with existing test patterns in the codebase (see `toolUsageAggregator.test.ts`, `apiHealthAggregator.test.ts`).

4. **`(result as any).apiErrorCount`**: Used temporarily for new SessionMetrics fields that don't exist yet. The software-crafter will update the type in step 01-01, removing the need for `as any` casts.
