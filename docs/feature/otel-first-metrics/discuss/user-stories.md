<!-- markdownlint-disable MD024 -->

# OTel-First Metrics Pipeline -- User Stories

## US-OFM-01: Cost Single Source of Truth

### Problem

Kai Nakamura is a Norbert power user who monitors session costs against a $2,000/mo team budget. When OTel is active, both `api_request` (with `cost_usd`) and hook events (`prompt_submit`, `tool_call_end`, `agent_complete`) contribute token and cost data to SessionMetrics. Kai sees $9.74 on the dashboard but Anthropic billing shows $4.87 -- the double-counting erodes trust in the entire dashboard.

### Who

- Norbert operator | OTel configured via Claude Code telemetry | Needs accurate cost to manage team AI budget

### Solution

When a session is OTel-active, the metrics aggregator suppresses token/cost accumulation from hook events (`prompt_submit`, `tool_call_end`, `agent_complete`). Only `api_request` events contribute to `totalTokens` and `sessionCost`. Hook events still contribute structural data (agent counts, session start/end). When OTel is not active, all hook events contribute as today (backward compatible).

### Domain Examples

#### 1: Happy Path -- OTel session with cost_usd

Kai's session "norbert-refactor" receives 3 `api_request` events with `cost_usd` values of $0.42, $1.15, and $0.83. It also receives 2 `prompt_submit` and 1 `tool_call_end` event with token data. The dashboard shows $2.40 total cost -- matching only the `api_request` sum. The hook token data is ignored for cost.

#### 2: Backward Compatible -- Hook-only session

Kai's colleague Priya runs a session without OTel. Her session receives `prompt_submit` events with 1,500 input tokens and 800 output tokens on `claude-sonnet-4-20250514`. The pricing model calculates cost from token counts as it does today. Nothing changes for hook-only sessions.

#### 3: Edge Case -- api_request without cost_usd

Kai's session receives an `api_request` event with token counts but no `cost_usd` field (e.g., older OTel exporter version). The aggregator falls back to `calculateCost()` using the pricing model, same as hook events. No data is lost.

#### 4: Mixed Events -- Hook structure preserved

Kai's OTel-active session receives a `session_start` hook event followed by an `agent_complete` with token data. The `activeAgentCount` increments and then decrements correctly. But the `agent_complete` token/cost data is not added to `sessionCost` because OTel is active.

### UAT Scenarios (BDD)

#### Scenario: OTel cost_usd is single source of truth

Given Kai's session "norbert-refactor" is OTel-active
And 3 api_request events arrive with cost_usd $0.42, $1.15, $0.83
And 2 prompt_submit events arrive with token usage data
When the metrics aggregator processes all events
Then sessionCost equals $2.40
And totalTokens reflects only the api_request token data

#### Scenario: Hook-only session cost unchanged

Given Priya's session "quick-fix" has no api_request events
And a prompt_submit event arrives with 1500 input tokens and 800 output tokens on "claude-sonnet-4-20250514"
When the metrics aggregator processes the event
Then sessionCost is calculated via the pricing model
And totalTokens equals 2300

#### Scenario: api_request without cost_usd falls back to pricing model

Given Kai's OTel-active session receives an api_request event
And the payload contains 2000 input tokens and 1000 output tokens on "claude-sonnet-4-20250514"
And the payload does not contain cost_usd
When the metrics aggregator processes the event
Then sessionCost uses the pricing model calculation as fallback

#### Scenario: Agent count updates but cost suppressed from agent_complete

Given Kai's session is OTel-active with activeAgentCount of 1
And an agent_complete event arrives with 500 input tokens and 200 output tokens
When the metrics aggregator processes the event
Then activeAgentCount decrements to 0
And sessionCost does not change from the agent_complete token data

#### Scenario: Mid-session OTel activation preserves pre-OTel cost

Given Kai's session starts as hook-only with prompt_submit events contributing $1.20 to sessionCost
And the first api_request event arrives making the session OTel-active
When subsequent prompt_submit events arrive
Then the $1.20 from before OTel activation remains in sessionCost
And subsequent hook token/cost data is suppressed
And only new api_request cost_usd values are added going forward

### Acceptance Criteria

- [ ] When OTel active, prompt_submit does not contribute to totalTokens or sessionCost
- [ ] When OTel active, tool_call_end does not contribute to totalTokens or sessionCost
- [ ] When OTel active, agent_complete does not contribute to totalTokens or sessionCost but still updates activeAgentCount
- [ ] When OTel not active, all hook events contribute to metrics as before (backward compatible)
- [ ] api_request without cost_usd falls back to pricing model calculation
- [ ] sessionCost equals sum of api_request cost_usd values within floating-point tolerance of $0.001 (for pure OTel sessions)
- [ ] When session transitions from hook-only to OTel-active mid-session, pre-existing cost is preserved

### Technical Notes

- Requires OTel-active flag to be available in the aggregator dispatch context
- The `applyCommonFields` (hookEventCount, lastEventAt) should still apply to all events regardless of OTel status
- Depends on: `otelDetection.isOtelActiveSession()` (already exists)
- Breaking change: aggregateEvent signature may need an `isOtelActive` parameter, or the dispatch table must be selected based on session state

---

## US-OFM-02: Rich Tool Tracking from OTel

### Problem

Kai Nakamura wants to understand which Claude Code tools are slow or failing. Today, `tool_call_start` only increments a counter -- there is no breakdown by tool name, duration, or success. Meanwhile, OTel `tool_result` events carry all this data but are discarded as no-ops. Kai sees "Tools: 47" and has no idea if 10 of those were failed Bash calls taking 5 seconds each.

### Who

- Norbert operator | Debugging slow sessions | Needs per-tool breakdown to optimize workflow

### Solution

When OTel is active, `tool_result` events increment `toolCallCount` and feed the existing `toolUsageAggregator` for per-tool stats. `tool_call_start` from hooks becomes a no-op (superseded). When OTel is not active, `tool_call_start` continues to increment the counter as today.

### Domain Examples

#### 1: Happy Path -- OTel tool breakdown

Kai's session receives 5 `tool_result` events: Read(success, 120ms), Write(success, 340ms), Bash(failure, 5200ms), Read(success, 95ms), Grep(success, 210ms). The dashboard shows toolCallCount of 5, with per-tool breakdown: Read (2 calls, 100% success, avg 108ms), Write (1 call, 100%, 340ms), Bash (1 call, 0% success, 5200ms), Grep (1 call, 100%, 210ms).

#### 2: Backward Compatible -- Hook-only tool count

Priya's hook-only session receives 3 `tool_call_start` events. The dashboard shows toolCallCount of 3 with no per-tool breakdown (data not available from hooks).

#### 3: Edge Case -- OTel active suppresses tool_call_start

Kai's OTel-active session receives 2 `tool_result` events and 2 `tool_call_start` events (hooks still firing). toolCallCount shows 2 (from tool_result only), not 4.

### UAT Scenarios (BDD)

#### Scenario: Tool call count and breakdown from tool_result

Given Kai's session is OTel-active
And 5 tool_result events arrive: Read(success, 120ms), Write(success, 340ms), Bash(failure, 5200ms), Read(success, 95ms), Grep(success, 210ms)
When the metrics aggregator processes all events
Then toolCallCount equals 5
And the tool usage summary shows successRate of 0.8
And the per-tool breakdown shows Bash with successRate 0 and avgDurationMs 5200

#### Scenario: Hook-only tool count unchanged

Given Priya's session has no api_request events
And 3 tool_call_start events arrive
When the metrics aggregator processes all events
Then toolCallCount equals 3

#### Scenario: OTel active suppresses tool_call_start

Given Kai's session is OTel-active
And 2 tool_result events and 2 tool_call_start events arrive
When the metrics aggregator processes all events
Then toolCallCount equals 2

### Acceptance Criteria

- [ ] When OTel active, tool_result increments toolCallCount
- [ ] When OTel active, tool_result feeds toolUsageAggregator with name, duration, success
- [ ] When OTel active, tool_call_start does not increment toolCallCount
- [ ] When OTel not active, tool_call_start increments toolCallCount as before
- [ ] Per-tool breakdown includes count, successCount, successRate, avgDurationMs per tool name

### Technical Notes

- `toolUsageAggregator.ts` already has the `ToolResultEvent` interface and `aggregateToolUsage()` function -- it just needs to be wired into the metrics pipeline
- The aggregator currently processes tool_result events in a batch; may need to integrate into the fold-based `aggregateEvent` flow
- Depends on: US-OFM-01 (OTel-active flag in aggregator context)

---

## US-OFM-03: API Error Visibility

### Problem

Kai Nakamura notices a session cost of $8.50 that seems high for the work done. The cause is 4 API errors that triggered retries, but `api_error` events are discarded as no-ops. Kai cannot correlate error count with cost, making cost spikes unexplainable.

### Who

- Norbert operator | Investigating cost anomalies | Needs error count and rate to explain unexpected costs

### Solution

The metrics aggregator handles `api_error` events by incrementing a new `apiErrorCount` field in SessionMetrics. A derived `apiErrorRate` (errors / total API interactions) provides at-a-glance error health.

### Domain Examples

#### 1: Happy Path -- Errors tracked

Kai's session receives 8 `api_request` events and 3 `api_error` events. SessionMetrics shows apiErrorCount of 3 and apiErrorRate of approximately 0.27 (3/11).

#### 2: Clean Session -- No errors

Kai's session receives 12 `api_request` events and 0 `api_error` events. apiErrorCount is 0, apiErrorRate is 0.

#### 3: Error Storm -- Explains cost spike

Kai's session "budget-check" accumulates $3.20 from 6 `api_request` events. 4 of those were retries following `api_error` events. The dashboard shows 4 errors, helping Kai understand the cost spike was retry-driven.

### UAT Scenarios (BDD)

#### Scenario: API errors increment error count

Given Kai's OTel-active session receives 8 api_request events and 3 api_error events
When the metrics aggregator processes all events
Then apiErrorCount equals 3
And apiErrorRate is approximately 0.27

#### Scenario: Zero errors in healthy session

Given Kai's session receives 12 api_request events and 0 api_error events
When the metrics aggregator processes all events
Then apiErrorCount equals 0
And apiErrorRate equals 0

#### Scenario: Error count correlates with cost anomaly

Given Kai's session "budget-check" has $3.20 cost from 6 api_request events
And 4 api_error events preceded 4 of those api_request retries
When Kai reviews session metrics
Then apiErrorCount shows 4
And the high error count explains the elevated cost

### Acceptance Criteria

- [ ] api_error events increment apiErrorCount in SessionMetrics
- [ ] apiErrorRate equals apiErrorCount / (apiErrorCount + apiRequestCount), where apiRequestCount tracks total api_request events processed
- [ ] apiErrorCount starts at 0 for new sessions
- [ ] apiRequestCount starts at 0 for new sessions and increments on each api_request event
- [ ] api_error handler also updates lastEventAt and totalEventCount (common fields)

### Technical Notes

- New fields on SessionMetrics: `apiErrorCount: number`, `apiRequestCount: number` (needed for rate calculation)
- `apiErrorRate` can be computed on read (not stored) or stored as derived field updated on each api_error/api_request event
- No UI changes in this story -- error data flows into SessionMetrics for future dashboard consumption
- Depends on: none (can be implemented independently)

---

## US-OFM-04: Source-Agnostic Data Health Indicator

### Problem

Kai Nakamura opens Norbert and sees the hookHealth indicator showing "degraded" even though OTel data is flowing perfectly. The current `buildWarningCluster` only checks `hookEventCount`, which is misleading when OTel is the primary data source. Kai loses confidence in the dashboard before even looking at the numbers.

### Who

- Norbert operator | First thing checked on dashboard | Needs instant confidence that data pipeline is working

### Solution

Replace the `hookHealth` gauge with a source-agnostic `dataHealth` indicator that considers total event count (hook + OTel) and event recency. Three states: "healthy" (events flowing, recent), "degraded" (events exist but stale), "no-data" (no events received).

### Domain Examples

#### 1: Happy Path -- OTel healthy

Kai's session has received 42 events (all OTel). The most recent arrived 5 seconds ago. Data health shows "healthy" with detail "OTel active, 42 events".

#### 2: Happy Path -- Hooks healthy

Priya's hook-only session has received 28 events. Most recent arrived 10 seconds ago. Data health shows "healthy".

#### 3: Stale Data -- Degraded

Kai's session has 15 events but the most recent arrived 90 seconds ago. Data health shows "degraded".

#### 4: New Session -- No data

A fresh session "just-started" has been created but no events received. Data health shows "no-data".

### UAT Scenarios (BDD)

#### Scenario: Healthy when OTel events flowing

Given Kai's session has received 42 OTel events
And the most recent event arrived 5 seconds ago
When the gauge cluster computes warning data
Then dataHealth status is "healthy"

#### Scenario: Healthy when hook events flowing

Given Priya's hook-only session has received 28 events
And the most recent event arrived 10 seconds ago
When the gauge cluster computes warning data
Then dataHealth status is "healthy"

#### Scenario: Degraded when events stale

Given Kai's session has received 15 events
And the most recent event arrived 90 seconds ago
When the gauge cluster computes warning data
Then dataHealth status is "degraded"

#### Scenario: No-data when no events received

Given a new session has just been created with 0 events
When the gauge cluster computes warning data
Then dataHealth status is "no-data"

### Acceptance Criteria

- [ ] WarningClusterData type changes from `hookHealth: "normal" | "degraded" | "error"` to `dataHealth: "healthy" | "degraded" | "no-data"`
- [ ] dataHealth considers total event count (hook + OTel combined)
- [ ] dataHealth considers event recency (last event timestamp vs current time)
- [ ] Staleness threshold for degraded status is configurable (default 60 seconds)
- [ ] Backward compatible: hook-only sessions show "healthy" when events flow

### Technical Notes

- `SessionMetrics.hookEventCount` renamed to `totalEventCount` -- all consumers must be updated
- `SessionMetrics.lastEventAt` already exists and is updated by `applyCommonFields`
- `buildWarningCluster` needs `lastEventAt` and current time as inputs (pure function: pass current time, do not call Date.now() internally)
- Breaking type change on `WarningClusterData` and `GaugeClusterData` -- all UI consumers must update
- Depends on: none (can be implemented independently, but pairs well with US-OFM-01)

---

## US-OFM-05: OTel Session Timing Preference

### Problem

Kai Nakamura's session shows a start time from the `session_start` hook event, which reflects when Claude Code registered the hook -- not when actual API activity began. When OTel is active, the first `api_request` timestamp is more accurate because it reflects the actual first API call. The difference is typically a few seconds, but it affects burn rate calculations and session duration display.

### Who

- Norbert operator | Reviewing session duration and burn rate | Needs accurate session boundaries

### Solution

When OTel is active, `sessionStartedAt` is set from the first `api_request` event's `receivedAt` timestamp. If a `session_start` hook event arrives first, it sets `sessionStartedAt` provisionally, but the first `api_request` overwrites it. When OTel is not active, `session_start` sets the timestamp as today.

### Domain Examples

#### 1: Happy Path -- OTel timestamp preferred

Kai's session receives `session_start` at 10:00:05Z, then `api_request` at 10:00:02Z (earlier timestamp because the API call started before the hook registered). `sessionStartedAt` shows 10:00:02Z.

#### 2: Backward Compatible -- Hook timing preserved

Priya's hook-only session receives `session_start` at 10:00:05Z. No `api_request` events. `sessionStartedAt` shows 10:00:05Z.

#### 3: Edge Case -- api_request arrives before session_start

Kai's session receives `api_request` at 10:00:02Z before `session_start` at 10:00:05Z (event ordering). `sessionStartedAt` is set to 10:00:02Z from api_request, and session_start does not overwrite it.

### UAT Scenarios (BDD)

#### Scenario: First api_request sets session start when OTel active

Given Kai's session receives a session_start event at "2026-03-27T10:00:05Z"
And then receives its first api_request event at "2026-03-27T10:00:02Z"
When the metrics aggregator processes both events
Then sessionStartedAt equals "2026-03-27T10:00:02Z"

#### Scenario: Session start from hook when not OTel active

Given Priya's session receives a session_start event at "2026-03-27T10:00:05Z"
And no api_request events arrive
When the metrics aggregator processes the event
Then sessionStartedAt equals "2026-03-27T10:00:05Z"

#### Scenario: api_request before session_start preserves earlier timestamp

Given Kai's session receives an api_request event at "2026-03-27T10:00:02Z"
And then receives a session_start event at "2026-03-27T10:00:05Z"
When the metrics aggregator processes both events
Then sessionStartedAt equals "2026-03-27T10:00:02Z"

### Acceptance Criteria

- [ ] First api_request sets sessionStartedAt when OTel is active
- [ ] session_start sets sessionStartedAt only if not already set
- [ ] When OTel not active, session_start sets sessionStartedAt as before
- [ ] sessionStartedAt always reflects the earliest meaningful timestamp for the session

### Technical Notes

- Requires the api_request handler to check and set `sessionStartedAt` when it is empty
- The `applySessionStart` function should check if `sessionStartedAt` is already set (by api_request) before overwriting
- `applySessionStart` already has the guard `metrics.sessionStartedAt === "" ? receivedAt : metrics.sessionStartedAt` -- the api_request handler just needs the same pattern
- Depends on: US-OFM-01 (OTel-active context in aggregator)
