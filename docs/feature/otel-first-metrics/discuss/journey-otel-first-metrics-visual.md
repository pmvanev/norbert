# Journey: OTel-First Metrics Pipeline

## Persona

**Kai Nakamura** -- Norbert power user, runs 3-5 Claude Code sessions daily across multiple projects. Has OTel configured via Claude Code's built-in telemetry. Monitors session costs closely because the team has a monthly AI budget of $2,000. Currently notices cost figures that seem "too high" but cannot pinpoint why.

## Goal

When viewing session metrics in Norbert, see accurate cost/token/tool data regardless of whether the session uses hooks, OTel, or both -- with clear indication of data pipeline health.

## Emotional Arc

```
Start: Suspicious       Middle: Reassured       End: Trusting
"These numbers           "I can see where        "I trust the dashboard.
 seem wrong..."           data comes from"        Numbers match my bill."
```

## Journey Flow

```
[Session Active]     [Metrics Flowing]     [Dashboard View]      [Health Check]
  OTel + Hooks         Dispatch &            Gauge Cluster         Data Health
  events arrive        Aggregate             renders costs         indicator shows
                                                                   pipeline status

  Feels:               Feels:                Feels:                Feels:
  Unaware              N/A (system)          Confident OR          Informed
                                             Suspicious

  Artifacts:           Artifacts:            Artifacts:            Artifacts:
  Raw events           SessionMetrics        GaugeClusterData      DataHealth status
  (api_request,        (tokens, cost,        (odometer, warning    ("healthy" /
   tool_result,         toolCallCount,        cluster)              "degraded" /
   api_error)           errorCount)                                 "hooks-only")
```

## Step-by-Step Detail

### Step 1: Cost Accuracy (Single Source of Truth)

**Problem**: When OTel is active, both `api_request` (with `cost_usd`) and hook events (`prompt_submit`, `tool_call_end`, `agent_complete`) contribute token/cost data. This double-counts.

**Current behavior**:
```
api_request  --> applyApiRequestTokenUsage() --> adds tokens + cost_usd
prompt_submit --> applyTokenUsage()           --> adds tokens + calculated cost  <-- DUPLICATE
tool_call_end --> applyTokenUsage()           --> adds tokens + calculated cost  <-- DUPLICATE
agent_complete -> applyTokenUsage()           --> adds tokens + calculated cost  <-- DUPLICATE
```

**Desired behavior** (when OTel active):
```
api_request   --> applyApiRequestTokenUsage() --> adds tokens + cost_usd    <-- SINGLE SOURCE
prompt_submit --> identity (no-op for cost)   --> skip token/cost
tool_call_end --> identity (no-op for cost)   --> skip token/cost
agent_complete -> applyAgentCompleteCount()   --> agent count only, no cost
```

**Emotional annotation**: Kai sees $4.87 on dashboard, checks Anthropic billing, sees $4.92. Close enough -- trusts it. Today: Kai sees $9.74 (double), checks billing at $4.87 -- loses trust.

### Step 2: Tool Call Tracking (Rich Data)

**Problem**: Hook's `tool_call_start` only increments a counter. OTel's `tool_result` carries name, duration, success -- currently a no-op.

**Current behavior**:
```
tool_call_start --> toolCallCount++ (counter only, no name/duration/success)
tool_result     --> identity (no-op!)
```

**Desired behavior** (when OTel active):
```
tool_call_start --> identity (no-op, superseded by tool_result)
tool_result     --> toolCallCount++ AND feed toolUsageAggregator
```

**Emotional annotation**: Kai wonders "which tools are slow?" -- today the answer is just a number. With OTel: per-tool breakdown with success rates.

### Step 3: Error Metrics (New Visibility)

**Problem**: `api_error` events are received but discarded (no-op handler). Errors are invisible.

**Current behavior**:
```
api_error --> identity (no-op)
```

**Desired behavior**:
```
api_error --> increment errorCount, track error rate
```

**New SessionMetrics fields**: `apiErrorCount`, `apiErrorRate` (errors / total api_requests).

**Emotional annotation**: Kai sees a session cost spike. With error tracking: "Ah, 12 retries on that prompt -- that explains the cost."

### Step 4: Data Health Indicator (Source-Agnostic)

**Problem**: `buildWarningCluster` only checks `hookEventCount`. When OTel is the primary source, hookEventCount may be 0 even though data is flowing perfectly.

**Current behavior**:
```
hookEventCount === 0 --> "degraded"  (misleading when OTel is active!)
hookEventCount > 0   --> "normal"
```

**Desired behavior**:
```
                                              +--> "healthy" (events flowing)
totalEventCount > 0 AND recentEventAge < 60s -+
                                              +--> "degraded" (events stale)
totalEventCount === 0                         ----> "no-data"
```

**Dashboard mockup** (warning cluster area):

```
+-- Warning Cluster -----------------------------------------------+
|                                                                   |
|  Current (hook-only):     [!] Hook Health: degraded               |
|                                                                   |
|  Proposed (source-agnostic):                                      |
|                                                                   |
|    [*] Data Health: healthy          (OTel active, 142 events)    |
|    [*] Data Health: healthy          (Hooks active, 89 events)    |
|    [!] Data Health: degraded         (Last event 3m ago)          |
|    [x] Data Health: no-data          (No events received)         |
|                                                                   |
+-------------------------------------------------------------------+
```

**Emotional annotation**: Kai opens Norbert, sees "Data Health: healthy (OTel active, 142 events)" -- immediate confidence. Today: sees "degraded" despite OTel working fine -- confusion, distrust.

### Step 5: Transcript Polling Legacy Path

**Problem**: Transcript polling is already skipped when OTel is active (ADR-034). Need to formally mark it as legacy and ensure the fallback chain is clear.

**Current behavior**: Already correct -- `isOtelActiveSession()` gates transcript polling.

**Desired behavior**: No code change needed. Document the deprecation path and ensure the transcript provider tag is tracked for data provenance.

### Step 6: Session Timing (OTel Preferred)

**Problem**: `sessionStartedAt` is set from hook `session_start` event's `receivedAt`. When OTel is active, the first `api_request` timestamp may be more accurate (it reflects actual API activity, not hook registration).

**Current behavior**:
```
session_start --> sessionStartedAt = receivedAt (hook registration time)
```

**Desired behavior** (when OTel active):
```
api_request (first) --> sessionStartedAt = receivedAt (actual activity start)
session_start       --> sessionStartedAt only if not already set by OTel
```

## Integration Points

| From | To | Data | Risk |
|------|-----|------|------|
| `otelDetection.isOtelActiveSession()` | `metricsAggregator` dispatch | OTel-active flag | HIGH -- wrong flag = double-count or zero-count |
| `metricsAggregator` | `gaugeCluster` | SessionMetrics (new fields) | MEDIUM -- new fields must propagate |
| `metricsAggregator` | `toolUsageAggregator` | tool_result events | LOW -- already exists, just needs wiring |
| `hookProcessor` | `metricsAggregator` | OTel-awareness context | HIGH -- processor must know session's OTel status |

## Error Paths

1. **OTel detection wrong (false positive)**: Session flagged OTel-active but no `api_request` events actually have cost_usd. Mitigation: fall back to pricing model calculation.
2. **OTel detection wrong (false negative)**: OTel events arrive but session not flagged. Mitigation: detection is `events.some(e => e.event_type === "api_request")` -- cannot be false negative if api_request exists.
3. **Mixed session**: Some events from hooks, some from OTel. Mitigation: when OTel active, hooks contribute structure (session_start/end, agent counts) but not cost/tokens.
4. **cost_usd field missing on api_request**: Already handled -- `applyApiRequestTokenUsage` falls back to pricing model.
