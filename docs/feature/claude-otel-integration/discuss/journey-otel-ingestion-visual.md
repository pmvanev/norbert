# Journey Visual: OTel Data Ingestion

**Feature ID**: claude-otel-integration
**Journey**: Real-time token/cost data from Claude Code via OpenTelemetry
**Persona**: Developer running Norbert alongside Claude Code sessions

---

## Journey Flow

```
[1. Enable OTel]     [2. Receive OTLP]     [3. Extract Usage]
  User sets env   -->  POST /v1/traces  -->  Parse span attrs
  vars or uses         on port 3748          input_tokens,
  setup wizard                               output_tokens,
                                             cost_usd, model
  Feels: Curious       Feels: (invisible)    Feels: (invisible)
  -> Reassured

        |                    |                     |
        v                    v                     v

[4. Persist Event]    [5. Charts Update]    [6. Fallback Logic]
  EventStore.         tokenExtractor +       OTel active?
  write_event()       metricsAggregator      -> skip transcripts
  type: api_request   -> oscilloscope        OTel absent?
                      charts refresh         -> poll transcripts

  Feels: (invisible)  Feels: Anticipating    Feels: Neutral
                       -> Delighted           -> Reassured
```

---

## Emotional Arc

```
Confidence
    ^
    |                                              *** Confident
    |                                         ****
    |                                    ****
    |                              **** Charts update!
    |                         ****
    |                    ****
    |              **** (invisible processing)
    |         ****
    |    ****
    | *** Curious/Cautious
    +-----------------------------------------------------> Time
    Setup     Receive    Extract    Persist    Display   Fallback
```

**Pattern**: Confidence Building
- Start: Curious but cautious (will this work?)
- Middle: Trust builds through invisible reliability (steps 2-4 just work)
- End: Confident and delighted (charts feel alive, data is real-time)

---

## Data Flow Diagram

```
+------------------+
|   Claude Code    |
|   (user session) |
+--------+---------+
         |
         | OTLP/HTTP POST /v1/traces
         | (ExportTraceServiceRequest JSON)
         |
         v
+--------+---------+     +---------------------+
| Hook Receiver    |     | Transcript JSONL     |
| (axum, port 3748)|     | (filesystem polling) |
|                  |     |                      |
| Routes:          |     | Fallback when OTel   |
|  /hooks/:type    |     | not configured       |
|  /v1/traces [NEW]|     +----------+-----------+
+--------+---------+                |
         |                          |
         | Parse claude_code.       | Parse JSONL,
         | api_request spans        | compute deltas
         |                          |
         v                          v
+--------+--------------------------+---------+
|              EventStore (SQLite)            |
|                                             |
|  Event {                                    |
|    session_id, event_type: api_request,     |
|    payload: { usage: { input_tokens,        |
|      output_tokens, cache_read_input_tokens,|
|      cache_creation_input_tokens,           |
|      cost_usd, model } },                   |
|    provider: "claude_code",                 |
|    received_at                              |
|  }                                          |
+---------------------+-----------------------+
                      |
                      | Frontend event poller
                      v
+---------------------+-----------------------+
|           Frontend Pipeline                 |
|                                             |
|  tokenExtractor.ts                          |
|    -> extractTokenUsage(payload)            |
|    -> { inputTokens, outputTokens, ... }    |
|                                             |
|  pricingModel.ts (when cost_usd absent)     |
|    OR cost_usd directly (when present)      |
|                                             |
|  metricsAggregator.ts                       |
|    -> SessionMetrics update                 |
|                                             |
|  OscilloscopeView.tsx                       |
|    -> Token rate chart                      |
|    -> Cost rate chart                       |
|    -> Context window gauge                  |
+---------------------------------------------+
```

---

## Step Details

### Step 1: Enable OTel Telemetry

**Action**: User configures Claude Code to export telemetry to Norbert

**Environment Variables**:
```
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748
```

**Key artifacts**:
- `${HOOK_PORT}` = 3748 (source: `domain/mod.rs`)
- `${OTEL_ENDPOINT}` = `http://127.0.0.1:${HOOK_PORT}`

**Emotional annotation**: The user is curious but slightly cautious. The setup wizard (future) should validate connectivity immediately -- "Connection verified" feedback transforms caution into reassurance.

---

### Step 2: Receive OTLP Trace Data

**Action**: Hook receiver accepts POST /v1/traces

**Request format** (OTLP/HTTP JSON):
```json
{
  "resourceSpans": [{
    "scopeSpans": [{
      "spans": [{
        "name": "claude_code.api_request",
        "attributes": [
          { "key": "input_tokens", "value": { "intValue": "1500" } },
          { "key": "output_tokens", "value": { "intValue": "800" } },
          { "key": "cache_read_tokens", "value": { "intValue": "500" } },
          { "key": "cache_creation_tokens", "value": { "intValue": "200" } },
          { "key": "cost_usd", "value": { "doubleValue": 0.042 } },
          { "key": "model", "value": { "stringValue": "claude-sonnet-4-20250514" } }
        ]
      }]
    }]
  }]
}
```

**Response**: 200 OK (empty body or `{}`)

---

### Step 3: Extract Token Usage from OTel Span

**Attribute mapping**:

```
OTel Span Attribute          Canonical Payload Field
-----------------------      ---------------------------
input_tokens            -->  usage.input_tokens
output_tokens           -->  usage.output_tokens
cache_read_tokens       -->  usage.cache_read_input_tokens
cache_creation_tokens   -->  usage.cache_creation_input_tokens
cost_usd                -->  usage.cost_usd (NEW - authoritative)
model                   -->  usage.model
```

**Critical integration point**: The `cache_read_tokens` and `cache_creation_tokens` OTel attribute names differ from the canonical field names (`cache_read_input_tokens`, `cache_creation_input_tokens`). The mapper must perform this rename.

---

### Step 4: Persist as Canonical Event

**New EventType variant**:
```rust
pub enum EventType {
    SessionStart,
    SessionEnd,
    ToolCallStart,
    ToolCallEnd,
    AgentComplete,
    PromptSubmit,
    ApiRequest,  // NEW
}
```

**Event record**:
```json
{
  "session_id": "sess-marco-2026-03-20",
  "event_type": "api_request",
  "payload": {
    "usage": {
      "input_tokens": 1500,
      "output_tokens": 800,
      "cache_read_input_tokens": 500,
      "cache_creation_input_tokens": 200,
      "cost_usd": 0.042,
      "model": "claude-sonnet-4-20250514"
    }
  },
  "received_at": "2026-03-20T14:30:00.123Z",
  "provider": "claude_code"
}
```

---

### Step 5: Frontend Picks Up OTel-Sourced Events

**Existing pipeline** (unchanged):
1. Event poller retrieves new events from EventStore
2. `tokenExtractor.ts` calls `extractTokenUsage(event.payload)` -- recognizes `payload.usage.*` shape
3. `pricingModel.ts` calculates cost (or uses `cost_usd` directly when present)
4. `metricsAggregator.ts` updates `SessionMetrics`
5. `OscilloscopeView.tsx` renders updated charts

**New behavior**: When `payload.usage.cost_usd` is present, it takes precedence over the local pricing model estimate. This provides authoritative cost from Anthropic's billing.

---

### Step 6: Graceful Fallback to Transcript Polling

**Decision logic per session**:
```
for each active session:
  if session has received any ApiRequest events (otelActive = true):
    skip transcript polling for this session
  else:
    continue transcript polling as before
```

**Transition safety**: If OTel events stop arriving mid-session (e.g., Claude Code process crash), the system does NOT automatically switch back to transcript polling. The session retains whatever data source it started with. Transcript polling only activates for sessions that never received OTel data.

---

## Error Paths

### E1: Claude Code OTel Not Configured

**Trigger**: User starts Claude Code without OTel env vars
**Behavior**: No OTLP data arrives. Transcript polling continues as before. Zero impact.
**User sees**: Same experience as pre-OTel Norbert.

### E2: Norbert Not Running When Claude Code Starts

**Trigger**: OTLP endpoint unreachable
**Behavior**: Claude Code's OTel exporter retries silently (per OTel SDK behavior). When Norbert starts, future spans are received. Past spans are lost.
**User sees**: Data appears once Norbert starts. Gap from before startup.

### E3: Malformed OTLP Payload

**Trigger**: Unexpected JSON structure (schema change in Claude Code)
**Behavior**: OTLP parser returns 400 or silently drops unparseable spans. Logged as warning.
**User sees**: Missing data points. Norbert status could indicate data source health.

### E4: Port Conflict on 3748

**Trigger**: Another process binds port 3748
**Behavior**: Already handled by existing hook receiver startup logic (exits with error).
**User sees**: Norbert fails to start with clear port-conflict error message.

### E5: Session ID Mismatch Between Hooks and OTel

**Trigger**: OTel spans use a different session identifier than hook events
**Behavior**: Events from the same Claude Code session are stored under different session IDs, fracturing session metrics.
**Mitigation**: Extract session_id from OTel resource attributes or span attributes; verify it matches the hook session_id format.
