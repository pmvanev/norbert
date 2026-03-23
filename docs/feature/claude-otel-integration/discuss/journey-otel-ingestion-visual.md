# Journey Visual: OTel Data Ingestion

**Feature ID**: claude-otel-integration
**Journey**: Real-time token/cost/prompt/tool/error data from Claude Code via OpenTelemetry
**Persona**: Developer running Norbert alongside Claude Code sessions
**Research Reference**: `docs/research/claude-code-otel-telemetry-actual-emissions.md` (2026-03-23)

---

## Journey Flow

```
[1. Enable OTel]     [2. Receive OTLP]     [3. Extract Events]
  User sets env   -->  POST /v1/logs    -->  Parse log record
  vars (or plugin       on port 3748         attrs by event type:
  auto-configures)                           api_request, user_prompt,
                                             tool_result, api_error,
  Feels: Curious       Feels: (invisible)    tool_decision
  -> Reassured
                                             Feels: (invisible)

        |                    |                     |
        v                    v                     v

[4. Persist Event]    [5. Charts Update]    [6. Fallback Logic]
  EventStore.         tokenExtractor +       OTel active?
  write_event()       metricsAggregator      -> skip transcripts
  types: api_request  -> oscilloscope        OTel absent?
  user_prompt, etc.   charts refresh         -> poll transcripts

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
         | OTLP/HTTP POST /v1/logs
         | (ExportLogsServiceRequest JSON)
         |
         | 5 event types:
         |   claude_code.api_request
         |   claude_code.user_prompt
         |   claude_code.tool_result
         |   claude_code.api_error
         |   claude_code.tool_decision
         |
         v
+--------+---------+     +---------------------+
| Hook Receiver    |     | Transcript JSONL     |
| (axum, port 3748)|     | (filesystem polling) |
|                  |     |                      |
| Routes:          |     | Fallback when OTel   |
|  /hooks/:type    |     | not configured       |
|  /v1/logs [NEW]  |     +----------+-----------+
+--------+---------+                |
         |                          |
         | Parse log records        | Parse JSONL,
         | by event.name,           | compute deltas
         | extract session.id       |
         |                          |
         v                          v
+--------+--------------------------+---------+
|              EventStore (SQLite)            |
|                                             |
|  Event {                                    |
|    session_id,                              |
|    event_type: api_request | user_prompt    |
|              | tool_result | api_error      |
|              | tool_decision,               |
|    payload: { ... per event type ... },     |
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
|  tokenExtractor.ts (for api_request)        |
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

**Environment Variables** (configured by norbert-cc-plugin or manually):
```
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748
OTEL_EXPORTER_OTLP_PROTOCOL=http/json
```

**Key artifacts**:
- `${HOOK_PORT}` = 3748 (source: `domain/mod.rs`)
- `${OTEL_ENDPOINT}` = `http://127.0.0.1:${HOOK_PORT}`
- norbert-cc-plugin configures these automatically in its settings.json

**Emotional annotation**: The user is curious but slightly cautious. Plugin-based auto-configuration reduces friction. A "Connection verified" feedback transforms caution into reassurance.

---

### Step 2: Receive OTLP Log Data

**Action**: Hook receiver accepts POST /v1/logs

**Request format** (OTLP/HTTP JSON -- ExportLogsServiceRequest):
```json
{
  "resourceLogs": [{
    "resource": {
      "attributes": [
        { "key": "service.name", "value": { "stringValue": "claude-code" } },
        { "key": "service.version", "value": { "stringValue": "1.0.x" } }
      ]
    },
    "scopeLogs": [{
      "scope": { "name": "com.anthropic.claude_code" },
      "logRecords": [{
        "timeUnixNano": "1711200000000000000",
        "severityNumber": 9,
        "body": { "stringValue": "claude_code.api_request" },
        "attributes": [
          { "key": "event.name", "value": { "stringValue": "api_request" } },
          { "key": "session.id", "value": { "stringValue": "sess-marco-2026-03-20" } },
          { "key": "input_tokens", "value": { "intValue": "1500" } },
          { "key": "output_tokens", "value": { "intValue": "800" } },
          { "key": "cache_read_tokens", "value": { "intValue": "500" } },
          { "key": "cache_creation_tokens", "value": { "intValue": "200" } },
          { "key": "cost_usd", "value": { "doubleValue": 0.042 } },
          { "key": "model", "value": { "stringValue": "claude-sonnet-4-20250514" } },
          { "key": "duration_ms", "value": { "intValue": "3200" } },
          { "key": "speed", "value": { "stringValue": "normal" } }
        ]
      }]
    }]
  }]
}
```

**Response**: 200 OK (empty body or `{}`)

---

### Step 3: Extract Event Data from OTel Log Records

**Event routing by event.name**:

| Event Name | Event Type | Required Attributes | Optional Attributes |
|------------|-----------|-------------------|-------------------|
| api_request | ApiRequest | input_tokens, output_tokens, model | cache_read_tokens, cache_creation_tokens, cost_usd, duration_ms, speed |
| user_prompt | UserPrompt | prompt_length | prompt (when OTEL_LOG_USER_PROMPTS=1) |
| tool_result | ToolResult | tool_name | success, duration_ms, error, tool_result_size_bytes, mcp_server_scope, tool_parameters |
| api_error | ApiError | error | model, status_code, duration_ms, attempt, speed |
| tool_decision | ToolDecision | tool_name | decision, source |

**Attribute mapping for api_request** (renaming to canonical shape):

```
OTel Log Record Attribute    Canonical Payload Field
-----------------------      ---------------------------
input_tokens            -->  usage.input_tokens
output_tokens           -->  usage.output_tokens
cache_read_tokens       -->  usage.cache_read_input_tokens
cache_creation_tokens   -->  usage.cache_creation_input_tokens
cost_usd                -->  usage.cost_usd (OTel-reported estimate)
model                   -->  usage.model
duration_ms             -->  usage.duration_ms
speed                   -->  usage.speed
```

**Standard attributes on ALL events** (extracted for every log record):
- `session.id` -- maps to internal session_id
- `prompt.id` -- correlates events from the same user prompt
- `event.timestamp`, `event.sequence` -- ordering

**Critical integration point**: The `cache_read_tokens` and `cache_creation_tokens` OTel attribute names differ from the canonical field names (`cache_read_input_tokens`, `cache_creation_input_tokens`). The mapper must perform this rename.

---

### Step 4: Persist as Canonical Event

**New EventType variants**:
```rust
pub enum EventType {
    SessionStart,
    SessionEnd,
    ToolCallStart,
    ToolCallEnd,
    AgentComplete,
    PromptSubmit,
    ApiRequest,     // NEW - OTel api_request
    UserPrompt,     // NEW - OTel user_prompt
    ToolResult,     // NEW - OTel tool_result
    ApiError,       // NEW - OTel api_error
    ToolDecision,   // NEW - OTel tool_decision
}
```

**Event record example** (for api_request):
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

**Existing pipeline** (unchanged for api_request events):
1. Event poller retrieves new events from EventStore
2. `tokenExtractor.ts` calls `extractTokenUsage(event.payload)` -- recognizes `payload.usage.*` shape
3. `pricingModel.ts` calculates cost (or uses `cost_usd` directly when present)
4. `metricsAggregator.ts` updates `SessionMetrics`
5. `OscilloscopeView.tsx` renders updated charts

**New behavior**: When `payload.usage.cost_usd` is present, it takes precedence over the local pricing model estimate. This provides OTel-reported cost from Anthropic (described as "estimated" in official docs, but more accurate than Norbert's local table).

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
**Behavior**: Claude Code's OTel exporter retries silently (per OTel SDK behavior). When Norbert starts, future log records are received. Past log records are lost.
**User sees**: Data appears once Norbert starts. Gap from before startup.

### E3: Malformed OTLP Payload

**Trigger**: Unexpected JSON structure (schema change in Claude Code)
**Behavior**: OTLP parser returns 400 or silently drops unparseable log records. Logged as warning.
**User sees**: Missing data points. Norbert status could indicate data source health.

### E4: Port Conflict on 3748

**Trigger**: Another process binds port 3748
**Behavior**: Already handled by existing hook receiver startup logic (exits with error).
**User sees**: Norbert fails to start with clear port-conflict error message.

### E5: Session ID Attribute Missing

**Trigger**: OTel log record arrives without `session.id` attribute
**Behavior**: Log record is dropped with a warning. No event persisted.
**Mitigation**: Log the warning for debugging; `session.id` is documented as a standard attribute on all events, so absence indicates a Claude Code configuration issue.

### E6: Unrecognized Event Name

**Trigger**: Claude Code adds new event types in a future version
**Behavior**: Log records with unrecognized event names are silently ignored (200 OK returned). Logged at INFO level for awareness.
**User sees**: No impact. New event types can be added to Norbert in future updates.
