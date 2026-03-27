# Shared Artifacts Registry: OTel-First Metrics

## otel_active_flag

- **Source of truth**: `src/domain/otelDetection.ts` -- `isOtelActiveSession(events)`
- **Consumers**:
  - `metricsAggregator.ts` -- dispatch table selects OTel-aware vs hook handlers
  - `hookProcessor.ts` -- passes OTel context to aggregator
  - `gaugeCluster.ts` -- data health indicator uses flag for source labeling
  - `App.tsx` (line 337) -- gates transcript polling
- **Owner**: norbert-usage plugin domain
- **Integration risk**: HIGH -- incorrect flag causes double-counting (false negative) or zero-counting (false positive)
- **Validation**: Unit test: session with at least one api_request event returns true; session without returns false

## session_cost

- **Source of truth**: `api_request.payload.usage.cost_usd` when OTel active; `pricingModel.calculateCost()` when hooks-only
- **Consumers**:
  - `SessionMetrics.sessionCost`
  - `gaugeCluster.ts` -- `buildOdometer()`
  - `multiSessionStore` -- aggregate cost across sessions
- **Owner**: metricsAggregator domain
- **Integration risk**: HIGH -- wrong source = inaccurate billing comparison
- **Validation**: Property test: for OTel-active session, sessionCost must equal sum of api_request cost_usd values (within floating point tolerance)

## tool_call_count

- **Source of truth**: `tool_result` event count when OTel active; `tool_call_start` event count when hooks-only
- **Consumers**:
  - `SessionMetrics.toolCallCount`
  - `toolUsageAggregator.ts` -- per-tool breakdown (OTel path only)
- **Owner**: metricsAggregator domain
- **Integration risk**: MEDIUM -- wrong source = incorrect count (not financial impact)
- **Validation**: Count test: toolCallCount matches number of tool_result events when OTel active

## api_error_count

- **Source of truth**: `metricsAggregator.ts` -- api_error handler
- **Consumers**:
  - `SessionMetrics.apiErrorCount` (new field)
  - `SessionMetrics.apiErrorRate` (new computed field)
- **Owner**: metricsAggregator domain
- **Integration risk**: LOW -- new field, no existing consumers to break
- **Validation**: Count test: apiErrorCount matches number of api_error events

## data_health_status

- **Source of truth**: `gaugeCluster.ts` -- `buildWarningCluster()` (renamed/refactored)
- **Consumers**:
  - `GaugeClusterData.warningCluster` (type changes from hookHealth to dataHealth)
  - Warning cluster UI component
- **Owner**: gaugeCluster domain
- **Integration risk**: MEDIUM -- type change in WarningClusterData breaks existing consumers
- **Validation**: State machine test: healthy/degraded/no-data transitions based on event count and recency

## total_event_count

- **Source of truth**: `SessionMetrics` -- currently `hookEventCount`, to be renamed `totalEventCount`
- **Consumers**:
  - `gaugeCluster.ts` -- health computation
  - `applyCommonFields()` in metricsAggregator
- **Owner**: metricsAggregator domain
- **Integration risk**: MEDIUM -- field rename requires updating all consumers
- **Validation**: All events (hook and OTel) increment the counter

## session_started_at

- **Source of truth**: First `api_request.receivedAt` when OTel active; `session_start.receivedAt` when hooks-only
- **Consumers**:
  - `SessionMetrics.sessionStartedAt`
  - Burn rate computation (needs duration)
- **Owner**: metricsAggregator domain
- **Integration risk**: LOW -- timing difference is small (seconds)
- **Validation**: When OTel active and api_request arrives before session_start, sessionStartedAt uses api_request timestamp
