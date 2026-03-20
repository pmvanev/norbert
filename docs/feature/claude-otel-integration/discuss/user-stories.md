<!-- markdownlint-disable MD024 -->

# User Stories: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**JTBD Traceability**: All stories trace to job stories JS-1, JS-2, JS-3 from `journey-otel-ingestion.yaml`

---

## US-COI-001: Receive OTel Token Data via OTLP Endpoint

### Problem

Marco Rossi is a developer using Norbert to monitor Claude Code costs in real-time. He finds it frustrating that token data arrives 3-9 seconds late because Norbert polls transcript JSONL files from disk every 3 seconds, and sometimes the file is locked by Claude Code, causing silent data gaps. Claude Code already emits this exact data via OpenTelemetry, but Norbert is not listening.

### Who

- Developer running Norbert | Active Claude Code session | Wants sub-second token/cost visibility

### Solution

Add a `POST /v1/traces` OTLP/HTTP endpoint to the existing hook receiver on port 3748. Parse incoming `ExportTraceServiceRequest` payloads, extract `claude_code.api_request` spans, map their attributes to the canonical event payload shape, and persist as `ApiRequest` events via the existing `EventStore`.

### Domain Examples

#### 1: Happy Path -- Marco's Sonnet session sends OTel data

Marco Rossi starts a Claude Code session with `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748`. Claude Code calls claude-sonnet-4-20250514, using 1,500 input tokens, 800 output tokens, 500 cache read tokens, 200 cache creation tokens, costing $0.042. Claude Code sends an OTLP trace to `/v1/traces`. Norbert parses the span, extracts the attributes, maps `cache_read_tokens` to `cache_read_input_tokens` and `cache_creation_tokens` to `cache_creation_input_tokens`, and persists an `ApiRequest` event. The entire round-trip from API response to event persistence takes less than 50ms.

#### 2: Edge Case -- Span with zero cache tokens

Marco's session makes a non-cached API call. The span has `cache_read_tokens=0` and `cache_creation_tokens=0`. The parser correctly maps these zero values into the canonical payload (does not treat them as missing).

#### 3: Error/Boundary -- Span missing required attributes

Claude Code sends a span named `claude_code.api_request` but the `output_tokens` attribute is missing (possible schema change). The parser detects the missing required field, logs a warning "Missing required attribute: output_tokens in claude_code.api_request span", drops the span, and returns 200 OK to avoid blocking Claude Code.

#### 4: Edge Case -- Non-Claude spans in the same request

A future OTel configuration sends spans from multiple instrumentations in a single `ExportTraceServiceRequest`. The request contains both `http.client.request` and `claude_code.api_request` spans. The parser processes only `claude_code.api_request` spans and silently ignores the rest.

#### 5: Error/Boundary -- Malformed OTLP JSON

A misconfigured client sends invalid JSON to `/v1/traces`. The hook receiver returns 400 Bad Request with a descriptive error message. No events are persisted. The error is logged.

### UAT Scenarios (BDD)

#### Scenario: Complete token usage extracted from OTel span

Given Norbert hook receiver is listening on port 3748
And Marco Rossi's Claude Code session sends OTLP data
When Claude Code sends a POST to /v1/traces containing a claude_code.api_request span with input_tokens=1500, output_tokens=800, cache_read_tokens=500, cache_creation_tokens=200, cost_usd=0.042, model="claude-sonnet-4-20250514"
Then an ApiRequest event is persisted with session_id matching Marco's session
And the payload contains usage.input_tokens=1500, usage.output_tokens=800, usage.cache_read_input_tokens=500, usage.cache_creation_input_tokens=200, usage.cost_usd=0.042, usage.model="claude-sonnet-4-20250514"

#### Scenario: Non-Claude spans silently ignored

Given Norbert hook receiver is listening on port 3748
When an OTLP client sends a POST to /v1/traces with spans named "http.client.request"
Then the hook receiver responds with 200 OK
And no events are persisted to the EventStore

#### Scenario: Missing required attribute drops span with warning

Given Norbert hook receiver is listening on port 3748
When Claude Code sends a POST to /v1/traces with a claude_code.api_request span missing the output_tokens attribute
Then the hook receiver responds with 200 OK
And no ApiRequest event is persisted for that span
And a warning log entry indicates the missing attribute

#### Scenario: OTLP endpoint coexists with hook endpoint

Given Norbert hook receiver is listening on port 3748
When Claude Code sends a hook POST to /hooks/PreToolUse with session_id "sess-marco"
And Claude Code sends an OTLP POST to /v1/traces with a claude_code.api_request span for session "sess-marco"
Then the hook event is persisted as a ToolCallStart event
And the OTel event is persisted as an ApiRequest event
And both events reference session "sess-marco"

#### Scenario: Malformed JSON returns 400

Given Norbert hook receiver is listening on port 3748
When a client sends a POST to /v1/traces with body "not valid json"
Then the hook receiver responds with 400 Bad Request
And no events are persisted

### Acceptance Criteria

- [ ] POST /v1/traces endpoint exists on port 3748 and accepts OTLP/HTTP JSON
- [ ] claude_code.api_request spans are extracted and mapped to canonical usage payload
- [ ] OTel attribute names are renamed to match tokenExtractor expected shape (cache_read_tokens -> cache_read_input_tokens, etc.)
- [ ] New ApiRequest variant added to EventType enum, serializing to "api_request"
- [ ] Events are persisted via existing EventStore.write_event() path
- [ ] Non-Claude spans are silently ignored (200 OK, no persistence)
- [ ] Missing required attributes drop the span with a logged warning
- [ ] Malformed OTLP JSON returns 400 Bad Request
- [ ] OTLP and hook routes coexist on the same server without interference

### Technical Notes

- Extend existing axum router in `hook_receiver.rs` with `/v1/traces` route
- Start with JSON-only OTLP support; protobuf support can be added later
- OTel `ExportTraceServiceRequest` structure: `resourceSpans[].scopeSpans[].spans[]`
- Session ID extraction strategy from OTel spans needs investigation (may be in resource attributes or span attributes)
- New `ApiRequest` variant requires updating EventType enum, Display impl, and all exhaustive matches
- Dependency: `serde_json` (already present), possibly `opentelemetry-proto` for type definitions

### JTBD Traceability

- JS-1: Real-time token data delivery

### Priority

- MoSCoW: **Must Have** -- core capability enabling the entire feature
- Value/Effort: High Value / Medium Effort

---

## US-COI-002: Display Authoritative Cost from OTel cost_usd

### Problem

Marco Rossi is a developer monitoring Claude Code costs with Norbert. He finds it unreliable that Norbert estimates costs using a local pricing table that can drift from Anthropic's actual pricing. When model pricing changes or new models launch, Norbert's cost estimates are wrong until someone manually updates `pricingModel.ts`. OTel events from Claude Code include `cost_usd` -- the authoritative cost calculated by Anthropic's billing system.

### Who

- Developer tracking AI spend | Active Claude Code session with OTel | Wants accurate cost data

### Solution

When an ApiRequest event payload contains `cost_usd`, use that value directly instead of calculating cost via the local pricing table. The pricing table remains as a fallback for transcript-polled events that lack `cost_usd`.

### Domain Examples

#### 1: Happy Path -- Authoritative cost used from OTel

Marco's session receives an ApiRequest event with `cost_usd=0.042` for a claude-sonnet-4-20250514 call. The metricsAggregator uses $0.042 directly. The local pricing model would have estimated $0.039 (slightly outdated rates). The dashboard shows the accurate $0.042.

#### 2: Edge Case -- Fallback to pricing model for transcript events

Ayumi Tanaka's session is using transcript polling (OTel not configured). Her events have token counts but no `cost_usd`. The metricsAggregator calculates cost using the local pricing table rates for claude-sonnet-4-20250514: $3.00/MTok input, $15.00/MTok output.

#### 3: Boundary -- cost_usd is zero

Marco's session receives a span where `cost_usd=0.0` (e.g., a cached response that cost nothing). The system treats this as a valid cost of $0.00 rather than falling back to the pricing model.

### UAT Scenarios (BDD)

#### Scenario: Authoritative cost from OTel overrides pricing model

Given Marco Rossi's session has received an ApiRequest event
And the event payload contains cost_usd = 0.042
When the metricsAggregator processes the event
Then the session cost increases by exactly $0.042
And the local pricing table is not consulted for this event

#### Scenario: Pricing model fallback when cost_usd absent

Given Ayumi Tanaka's session has received a token usage event via transcript polling
And the event payload does not contain cost_usd
And the model is "claude-sonnet-4-20250514" with 1500 input tokens and 800 output tokens
When the metricsAggregator processes the event
Then the session cost is calculated using local pricing model rates

#### Scenario: Zero cost_usd treated as valid

Given Marco Rossi's session receives an ApiRequest with cost_usd = 0.0
And 500 cache_read_input_tokens (fully cached response)
When the metricsAggregator processes the event
Then the session cost increases by $0.00
And the event is not treated as missing cost data

### Acceptance Criteria

- [ ] ApiRequest events with cost_usd present use the OTel value directly
- [ ] Events without cost_usd fall back to local pricing model calculation
- [ ] cost_usd = 0.0 is treated as valid (not missing)
- [ ] Cost display in metric cards and oscilloscope charts reflects authoritative cost

### Technical Notes

- `tokenExtractor.ts` or a new cost extraction step should check for `payload.usage.cost_usd`
- `pricingModel.ts` remains unchanged -- it is simply bypassed when `cost_usd` is present
- `SessionMetrics.sessionCost` accumulates the authoritative or estimated cost per event

### JTBD Traceability

- JS-1: Real-time token data delivery (cost accuracy dimension)

### Priority

- MoSCoW: **Should Have** -- significant accuracy improvement, but estimated costs work as fallback
- Value/Effort: High Value / Low Effort

---

## US-COI-003: Suppress Transcript Polling for OTel-Active Sessions

### Problem

Marco Rossi is a developer who has enabled OTel for Claude Code. He finds it confusing when Norbert shows inflated token counts because both OTel events AND transcript polling are feeding data into the metrics aggregator for the same session. The same API call's tokens get counted twice -- once from OTel, once from the transcript file -- doubling the apparent cost.

### Who

- Developer with OTel enabled | Active session with both data sources | Expects accurate (non-duplicate) metrics

### Solution

Track whether each active session has received any `ApiRequest` events (indicating OTel is active). When OTel is active for a session, skip transcript polling for that session. Sessions without OTel data continue to use transcript polling.

### Domain Examples

#### 1: Happy Path -- OTel-active session skips transcript polling

Marco Rossi's session "sess-marco-2026-03-20-a1b2c3" has received 5 ApiRequest events via OTel. The transcript polling timer fires. The poller checks the session's otelActive flag, finds it true, and skips Marco's session. No duplicate data.

#### 2: Happy Path -- Non-OTel session continues polling

Ayumi Tanaka's session "sess-ayumi-2026-03-20-d4e5f6" has received zero ApiRequest events. The transcript polling timer fires. The poller checks Ayumi's otelActive flag, finds it false, and reads her transcript JSONL file as before.

#### 3: Edge Case -- Mixed sessions simultaneously active

Marco (OTel active) and Ayumi (transcript only) are both running Claude Code sessions. When the transcript poller fires, it skips Marco's session and processes Ayumi's. Both sessions display correctly in the Performance Monitor without interference.

### UAT Scenarios (BDD)

#### Scenario: OTel-active session transcript polling suppressed

Given Marco Rossi's session "sess-marco-2026-03-20-a1b2c3" has received 3 ApiRequest events via OTel
When the transcript polling timer fires
Then the transcript poller skips session "sess-marco-2026-03-20-a1b2c3"
And no duplicate token data appears in the session metrics

#### Scenario: Non-OTel session continues transcript polling

Given Ayumi Tanaka's session "sess-ayumi-2026-03-20-d4e5f6" has received zero ApiRequest events
And her transcript file is available at the expected path
When the transcript polling timer fires
Then the transcript poller reads Ayumi's transcript JSONL file
And token data from the transcript appears in the Performance Monitor

#### Scenario: Mixed sessions handled independently

Given Marco Rossi's session is receiving OTel data (otelActive = true)
And Ayumi Tanaka's session is using transcript polling (otelActive = false)
When both sessions are active simultaneously
Then Marco's metrics come exclusively from OTel
And Ayumi's metrics come exclusively from transcript polling
And neither session shows duplicate data

#### Scenario: First ApiRequest event triggers OTel detection

Given Marco Rossi's session "sess-marco-new" has received zero ApiRequest events
And transcript polling is active for that session
When the first ApiRequest event arrives via OTel for "sess-marco-new"
Then the session's otelActive flag is set to true
And subsequent transcript polling cycles skip that session

### Acceptance Criteria

- [ ] Each session tracks whether it has received any ApiRequest events (otelActive flag)
- [ ] Transcript polling is skipped for sessions where otelActive is true
- [ ] Sessions without ApiRequest events continue transcript polling unchanged
- [ ] First ApiRequest event for a session triggers the otelActive transition
- [ ] No duplicate token data when both data sources are potentially available

### Technical Notes

- otelActive flag can be derived from session's ApiRequest event count (count > 0 = active)
- Transcript polling logic is in `App.tsx:270-325` (React effect)
- The flag check must happen per-session, not globally, to support mixed scenarios
- No configuration needed -- detection is automatic based on event presence

### JTBD Traceability

- JS-3: Graceful fallback from transcript polling to OTel

### Priority

- MoSCoW: **Must Have** -- without this, OTel-enabled users see doubled metrics
- Value/Effort: High Value / Low Effort

---

## US-COI-004: New ApiRequest Event Type in Domain Model

### Problem

Marco Rossi is a developer extending Norbert's event model. He finds that the current `EventType` enum has six variants (SessionStart, SessionEnd, ToolCallStart, ToolCallEnd, AgentComplete, PromptSubmit) but none representing an API request with token usage. OTel data needs a canonical event type to flow through the existing persistence and retrieval pipeline.

### Who

- Norbert developer | Extending the domain model | Needs type-safe event classification

### Solution

Add an `ApiRequest` variant to the `EventType` enum in `domain/mod.rs`. Update the `Display` implementation, serde serialization, and all exhaustive matches.

### Domain Examples

#### 1: Happy Path -- ApiRequest serializes to snake_case

The new `EventType::ApiRequest` variant serializes to `"api_request"` via serde, consistent with the existing pattern (e.g., `SessionStart` -> `"session_start"`).

#### 2: Happy Path -- ApiRequest deserializes from JSON

A JSON string `"api_request"` deserializes to `EventType::ApiRequest`, enabling the frontend to filter for these events.

#### 3: Boundary -- Existing event types unchanged

All six existing EventType variants continue to serialize and deserialize exactly as before. No behavioral change to existing events.

### UAT Scenarios (BDD)

#### Scenario: ApiRequest serializes to snake_case

Given a new EventType::ApiRequest value
When it is serialized to JSON via serde
Then the output is "api_request"

#### Scenario: ApiRequest deserializes from snake_case

Given the JSON string "api_request"
When it is deserialized as EventType
Then the result is EventType::ApiRequest

#### Scenario: Existing event types unaffected

Given the six existing EventType variants
When each is serialized and deserialized
Then all produce the same output as before the ApiRequest addition

### Acceptance Criteria

- [ ] `ApiRequest` variant added to `EventType` enum
- [ ] Serializes to `"api_request"` (snake_case, consistent with existing variants)
- [ ] Display trait outputs `"api_request"`
- [ ] All exhaustive match statements updated (compiler-enforced)
- [ ] Existing event types are not affected

### Technical Notes

- Rust compiler enforces exhaustive matching -- adding the variant will flag all locations needing updates
- Tests in `domain/mod.rs` need updating: `event_type_has_six_canonical_variants` becomes seven
- `HOOK_EVENT_NAMES` in `claude_code.rs` does NOT include ApiRequest (it is not a hook event)
- `parse_event_type` in `claude_code.rs` does NOT map any hook name to ApiRequest
- The `every_hook_event_name_is_parseable_and_every_variant_has_a_hook_name` test needs adjustment since ApiRequest has no hook name

### JTBD Traceability

- JS-1: Real-time token data delivery (infrastructure enabler)

### Priority

- MoSCoW: **Must Have** -- prerequisite for US-COI-001
- Value/Effort: High Value / Low Effort

### Dependencies

- None (first story in the implementation chain)
- Blocks: US-COI-001

---

## US-COI-005: OTel Session Identity Resolution

### Problem

Marco Rossi is a developer running Norbert with both hooks and OTel enabled. He finds it problematic when OTel events arrive with a session identifier that does not match the session_id from hook events, causing the same Claude Code session to appear as two separate sessions in Norbert's Performance Monitor. Hook events carry `session_id` in the JSON payload. OTel spans may carry the session identifier in different locations (resource attributes, span attributes, or trace context).

### Who

- Developer with both hooks and OTel active | Single Claude Code session | Expects unified session view

### Solution

Extract the session identifier from OTel spans in a way that produces the same `session_id` as hook events for the same Claude Code session. Investigate where Claude Code places the session ID in OTel data and implement the appropriate extraction logic.

### Domain Examples

#### 1: Happy Path -- Session IDs match between hooks and OTel

Marco starts a Claude Code session. Norbert receives a `SessionStart` hook with `session_id: "sess-marco-2026-03-20-a1b2c3"`. Subsequently, OTel spans arrive with the same session identifier in their attributes. The ApiRequest events are stored under `session_id: "sess-marco-2026-03-20-a1b2c3"`, and the Performance Monitor shows one unified session.

#### 2: Edge Case -- OTel data arrives before any hook event

Marco's Claude Code session sends an OTel span before the SessionStart hook fires. No session exists yet with that ID. Norbert creates the session from the OTel event and attributes subsequent hook events to the same session.

#### 3: Error -- Session ID format differs between hooks and OTel

Hook events use `"sess-marco-2026-03-20-a1b2c3"` but OTel resource attributes encode it as `"session:marco-2026-03-20-a1b2c3"`. Without normalization, events split across two sessions.

### UAT Scenarios (BDD)

#### Scenario: OTel and hook events share the same session ID

Given Marco Rossi's Claude Code session has session_id "sess-marco-2026-03-20-a1b2c3"
And Norbert receives a SessionStart hook event for that session
When an OTel span arrives for the same Claude Code session
Then the ApiRequest event is stored with session_id "sess-marco-2026-03-20-a1b2c3"
And the Performance Monitor shows one session with both hook and OTel events

#### Scenario: OTel event creates session when hooks not yet received

Given no session exists in the EventStore for "sess-otel-first"
When an OTel span arrives with session_id "sess-otel-first"
Then a new session is created with id "sess-otel-first"
And the session started_at is set to the OTel event received_at

#### Scenario: Session ID extraction handles known attribute locations

Given Claude Code OTel spans may carry session_id in span attributes or resource attributes
When the OTLP parser processes the span
Then it checks span attributes first, then resource attributes, for the session_id
And uses the first match found

### Acceptance Criteria

- [ ] Session ID extracted from OTel spans matches the session_id from hook events for the same Claude Code session
- [ ] OTel events creating sessions behave consistently with hook-created sessions
- [ ] Session ID extraction logic handles at least span attributes and resource attributes
- [ ] Missing session ID in OTel span drops the span with a logged warning

### Technical Notes

- This is a spike candidate -- the exact location of session_id in Claude Code OTel data needs verification
- Claude Code may use the OTel `service.instance.id` resource attribute or a custom `session_id` span attribute
- If session_id format differs between hooks and OTel, a normalization function is needed
- The hook receiver currently extracts session_id from `payload.session_id` (JSON body field)

### JTBD Traceability

- JS-1: Real-time token data delivery (session unification dimension)

### Priority

- MoSCoW: **Must Have** -- without session unification, metrics are fragmented
- Value/Effort: High Value / Medium Effort (investigation required)

### Dependencies

- Depends on: US-COI-004 (ApiRequest event type must exist)
- Blocks: US-COI-001 (session ID extraction is part of OTLP parsing)
