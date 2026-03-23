<!-- markdownlint-disable MD024 -->

# User Stories: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**JTBD Traceability**: All stories trace to job stories JS-1, JS-2, JS-3 from `journey-otel-ingestion.yaml`
**Research Reference**: `docs/research/claude-code-otel-telemetry-actual-emissions.md` (2026-03-23)

---

## US-COI-001: Receive OTel Event Data via OTLP Endpoint

### Problem

Marco Rossi is a developer using Norbert to monitor Claude Code costs in real-time. He finds it frustrating that token data arrives 3-9 seconds late because Norbert polls transcript JSONL files from disk every 3 seconds, and sometimes the file is locked by Claude Code, causing silent data gaps. Claude Code already emits this exact data as OTel log records via the OTLP logs protocol, but Norbert is not listening.

### Who

- Developer running Norbert | Active Claude Code session | Wants sub-second token/cost visibility

### Solution

Add a `POST /v1/logs` OTLP/HTTP endpoint to the existing hook receiver on port 3748. Parse incoming `ExportLogsServiceRequest` payloads, extract log records with event name `claude_code.api_request`, map their attributes to the canonical event payload shape, and persist as `ApiRequest` events via the existing `EventStore`.

### Domain Examples

#### 1: Happy Path -- Marco's Sonnet session sends OTel data

Marco Rossi starts a Claude Code session with `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748`. Claude Code calls claude-sonnet-4-20250514, using 1,500 input tokens, 800 output tokens, 500 cache read tokens, 200 cache creation tokens, costing an estimated $0.042. Claude Code sends an OTLP log export to `/v1/logs`. Norbert parses the log record, extracts the attributes, maps `cache_read_tokens` to `cache_read_input_tokens` and `cache_creation_tokens` to `cache_creation_input_tokens`, and persists an `ApiRequest` event. The entire round-trip from API response to event persistence takes less than 50ms.

#### 2: Edge Case -- Log record with zero cache tokens

Marco's session makes a non-cached API call. The log record has `cache_read_tokens=0` and `cache_creation_tokens=0`. The parser correctly maps these zero values into the canonical payload (does not treat them as missing).

#### 3: Error/Boundary -- Log record missing required attributes

Claude Code sends a log record with event name `claude_code.api_request` but the `output_tokens` attribute is missing (possible schema change). The parser detects the missing required field, logs a warning "Missing required attribute: output_tokens in claude_code.api_request log record", drops the log record, and returns 200 OK to avoid blocking Claude Code.

#### 4: Edge Case -- Non-Claude log records in the same request

A future OTel configuration sends log records from multiple instrumentations in a single `ExportLogsServiceRequest`. The request contains both generic log records and `claude_code.api_request` events. The parser processes only `claude_code.api_request` log records and silently ignores the rest.

#### 5: Error/Boundary -- Malformed OTLP JSON

A misconfigured client sends invalid JSON to `/v1/logs`. The hook receiver returns 400 Bad Request with a descriptive error message. No events are persisted. The error is logged.

### UAT Scenarios (BDD)

#### Scenario: Complete token usage extracted from OTel log record

Given Norbert hook receiver is listening on port 3748
And Marco Rossi's Claude Code session sends OTLP data
When Claude Code sends a POST to /v1/logs containing a claude_code.api_request log record with input_tokens=1500, output_tokens=800, cache_read_tokens=500, cache_creation_tokens=200, cost_usd=0.042, model="claude-sonnet-4-20250514"
Then an ApiRequest event is persisted with session.id matching Marco's session
And the payload contains usage.input_tokens=1500, usage.output_tokens=800, usage.cache_read_input_tokens=500, usage.cache_creation_input_tokens=200, usage.cost_usd=0.042, usage.model="claude-sonnet-4-20250514"

#### Scenario: Non-Claude log records silently ignored

Given Norbert hook receiver is listening on port 3748
When an OTLP client sends a POST to /v1/logs with log records that have no claude_code event names
Then the hook receiver responds with 200 OK
And no events are persisted to the EventStore

#### Scenario: Missing required attribute drops log record with warning

Given Norbert hook receiver is listening on port 3748
When Claude Code sends a POST to /v1/logs with a claude_code.api_request log record missing the output_tokens attribute
Then the hook receiver responds with 200 OK
And no ApiRequest event is persisted for that log record
And a warning log entry indicates the missing attribute

#### Scenario: OTLP endpoint coexists with hook endpoint

Given Norbert hook receiver is listening on port 3748
When Claude Code sends a hook POST to /hooks/PreToolUse with session_id "sess-marco"
And Claude Code sends an OTLP POST to /v1/logs with a claude_code.api_request log record for session "sess-marco"
Then the hook event is persisted as a ToolCallStart event
And the OTel event is persisted as an ApiRequest event
And both events reference session "sess-marco"

#### Scenario: Malformed JSON returns 400

Given Norbert hook receiver is listening on port 3748
When a client sends a POST to /v1/logs with body "not valid json"
Then the hook receiver responds with 400 Bad Request
And no events are persisted

### Acceptance Criteria

- [ ] POST /v1/logs endpoint exists on port 3748 and accepts OTLP/HTTP JSON
- [ ] claude_code.api_request log records are extracted and mapped to canonical usage payload
- [ ] OTel attribute names are renamed to match tokenExtractor expected shape (cache_read_tokens -> cache_read_input_tokens, etc.)
- [ ] New ApiRequest variant added to EventType enum, serializing to "api_request"
- [ ] Events are persisted via existing EventStore.write_event() path
- [ ] Non-Claude log records are silently ignored (200 OK, no persistence)
- [ ] Missing required attributes drop the log record with a logged warning
- [ ] Malformed OTLP JSON returns 400 Bad Request
- [ ] OTLP and hook routes coexist on the same server without interference

### Technical Notes

- Extend existing axum router in `hook_receiver.rs` with `/v1/logs` route
- Start with JSON-only OTLP support; protobuf support can be added later
- OTel `ExportLogsServiceRequest` structure: `resourceLogs[].scopeLogs[].logRecords[]`
- Event name is in the log record `body` field (stringValue) and/or `event.name` attribute
- Session ID is `session.id` (dot-separated) as a standard attribute on each log record (not a resource attribute)
- New `ApiRequest` variant requires updating EventType enum, Display impl, and all exhaustive matches
- Dependency: `serde_json` (already present), possibly `opentelemetry-proto` for type definitions
- The norbert-cc-plugin already configures the required env vars (`CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`) in its settings.json

### JTBD Traceability

- JS-1: Real-time token data delivery

### Priority

- MoSCoW: **Must Have** -- core capability enabling the entire feature
- Value/Effort: High Value / Medium Effort

---

## US-COI-002: Display OTel-Reported Cost from cost_usd

### Problem

Marco Rossi is a developer monitoring Claude Code costs with Norbert. He finds it unreliable that Norbert estimates costs using a local pricing table that can drift from Anthropic's actual pricing. When model pricing changes or new models launch, Norbert's cost estimates are wrong until someone manually updates `pricingModel.ts`. OTel events from Claude Code include `cost_usd` -- the estimated cost calculated by Anthropic, which is more accurate than Norbert's local pricing table but is described as "estimated" in official documentation.

### Who

- Developer tracking AI spend | Active Claude Code session with OTel | Wants accurate cost data

### Solution

When an ApiRequest event payload contains `cost_usd`, use that value directly instead of calculating cost via the local pricing table. The pricing table remains as a fallback for transcript-polled events that lack `cost_usd`.

### Domain Examples

#### 1: Happy Path -- OTel-reported cost used directly

Marco's session receives an ApiRequest event with `cost_usd=0.042` for a claude-sonnet-4-20250514 call. The metricsAggregator uses $0.042 directly. The local pricing model would have estimated $0.039 (slightly outdated rates). The dashboard shows the more accurate $0.042 from Anthropic's OTel reporting.

#### 2: Edge Case -- Fallback to pricing model for transcript events

Ayumi Tanaka's session is using transcript polling (OTel not configured). Her events have token counts but no `cost_usd`. The metricsAggregator calculates cost using the local pricing table rates for claude-sonnet-4-20250514: $3.00/MTok input, $15.00/MTok output.

#### 3: Boundary -- cost_usd is zero

Marco's session receives a log record where `cost_usd=0.0` (e.g., a cached response that cost nothing). The system treats this as a valid cost of $0.00 rather than falling back to the pricing model.

### UAT Scenarios (BDD)

#### Scenario: OTel-reported cost overrides pricing model

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

- [ ] ApiRequest events with cost_usd present use the OTel-reported value directly
- [ ] Events without cost_usd fall back to local pricing model calculation
- [ ] cost_usd = 0.0 is treated as valid (not missing)
- [ ] Cost display in metric cards and oscilloscope charts reflects OTel-reported cost

### Technical Notes

- `tokenExtractor.ts` or a new cost extraction step should check for `payload.usage.cost_usd`
- `pricingModel.ts` remains unchanged -- it is simply bypassed when `cost_usd` is present
- `SessionMetrics.sessionCost` accumulates the OTel-reported or locally estimated cost per event
- Official Anthropic docs describe `cost_usd` as "Estimated cost in USD" -- it is not authoritative billing data but is closer to actual pricing than Norbert's local table

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

Marco Rossi is a developer running Norbert with both hooks and OTel enabled. He finds it problematic when OTel events arrive with a session identifier that does not match the session_id from hook events, causing the same Claude Code session to appear as two separate sessions in Norbert's Performance Monitor. Hook events carry `session_id` in the JSON payload. OTel log records carry the session identifier as a standard attribute named `session.id` (dot-separated, not underscore).

### Who

- Developer with both hooks and OTel active | Single Claude Code session | Expects unified session view

### Solution

Extract `session.id` from OTel log record attributes (it is a standard attribute on all Claude Code events, not a resource attribute). Map it to the internal `session_id` used by the EventStore. Verify that `session.id` from OTel log records matches the `session_id` from hook events for the same Claude Code session.

### Domain Examples

#### 1: Happy Path -- Session IDs match between hooks and OTel

Marco starts a Claude Code session. Norbert receives a `SessionStart` hook with `session_id: "sess-marco-2026-03-20-a1b2c3"`. Subsequently, OTel log records arrive with `session.id: "sess-marco-2026-03-20-a1b2c3"` in their attributes. The ApiRequest events are stored under `session_id: "sess-marco-2026-03-20-a1b2c3"`, and the Performance Monitor shows one unified session.

#### 2: Edge Case -- OTel data arrives before any hook event

Marco's Claude Code session sends an OTel log record before the SessionStart hook fires. No session exists yet with that ID. Norbert creates the session from the OTel event and attributes subsequent hook events to the same session.

#### 3: Error -- session.id missing from log record

A log record arrives without the `session.id` attribute (unexpected based on official docs). The parser logs a warning "Missing session.id attribute in claude_code.api_request log record" and drops the log record. Norbert returns 200 OK to avoid blocking Claude Code.

### UAT Scenarios (BDD)

#### Scenario: OTel and hook events share the same session ID

Given Marco Rossi's Claude Code session has session_id "sess-marco-2026-03-20-a1b2c3"
And Norbert receives a SessionStart hook event for that session
When an OTel log record arrives with session.id "sess-marco-2026-03-20-a1b2c3"
Then the ApiRequest event is stored with session_id "sess-marco-2026-03-20-a1b2c3"
And the Performance Monitor shows one session with both hook and OTel events

#### Scenario: OTel event creates session when hooks not yet received

Given no session exists in the EventStore for "sess-otel-first"
When an OTel log record arrives with session.id "sess-otel-first"
Then a new session is created with id "sess-otel-first"
And the session started_at is set to the OTel event received_at

#### Scenario: Missing session.id drops the log record

Given a claude_code.api_request log record arrives via /v1/logs
And the log record does not contain a session.id attribute
When the OTLP parser processes the log record
Then no event is persisted
And a warning is logged indicating missing session.id

### Acceptance Criteria

- [ ] session.id extracted from OTel log record standard attributes (not resource attributes)
- [ ] Extracted session.id maps to the same session_id as hook events for the same Claude Code session
- [ ] OTel events creating sessions behave consistently with hook-created sessions
- [ ] Missing session.id in OTel log record drops the log record with a logged warning

### Technical Notes

- Research confirmed: `session.id` (dot-separated) is a standard attribute on ALL Claude Code events, not a resource attribute
- The attribute name is `session.id`, not `session_id` -- the parser must look for the dot-separated key
- Hook events use `session_id` (underscore) from the JSON body; OTel uses `session.id` (dot) from log record attributes -- the mapper normalizes to the internal `session_id` format
- Additional standard attributes available on all events: `organization.id`, `user.account_uuid`, `user.id`, `user.email`, `terminal.type`, `prompt.id`
- No spike needed -- research confirms the attribute name and location

### JTBD Traceability

- JS-1: Real-time token data delivery (session unification dimension)

### Priority

- MoSCoW: **Must Have** -- without session unification, metrics are fragmented
- Value/Effort: High Value / Low Effort (research resolved the uncertainty)

### Dependencies

- Depends on: US-COI-004 (ApiRequest event type must exist)
- Blocks: US-COI-001 (session ID extraction is part of OTLP parsing)

---

## US-COI-006: Ingest User Prompt Events from OTel

### Problem

Marco Rossi is a developer using Norbert to understand his Claude Code interaction patterns. He finds it difficult to correlate cost spikes with specific prompts because Norbert only receives API request data but has no visibility into what prompts triggered those requests. Claude Code emits `claude_code.user_prompt` events via OTel that capture when a user submits a prompt, including the prompt length and optionally the prompt content.

### Who

- Developer running Norbert | Active Claude Code session with OTel | Wants prompt-level visibility into session activity

### Solution

Extend the OTLP log record parser to recognize `claude_code.user_prompt` events. Extract the `prompt_length` attribute (and optionally `prompt` content when `OTEL_LOG_USER_PROMPTS=1` is enabled). Persist as a new `UserPrompt` event type via the EventStore.

### Domain Examples

#### 1: Happy Path -- Marco submits a prompt, event captured

Marco Rossi types "Refactor the authentication module to use session tokens" in Claude Code. Claude Code emits a `claude_code.user_prompt` log record with `prompt_length=62`, `session.id="sess-marco-2026-03-20-a1b2c3"`, and `prompt.id="a1b2c3d4-e5f6-7890-abcd-ef1234567890"`. Norbert persists a `UserPrompt` event linked to Marco's session.

#### 2: Edge Case -- Prompt content included when opted in

Marco has set `OTEL_LOG_USER_PROMPTS=1`. The log record includes `prompt="Refactor the authentication module to use session tokens"`. Norbert stores the prompt content in the event payload for display in the session timeline.

#### 3: Boundary -- Prompt content redacted by default

Ayumi Tanaka has not set `OTEL_LOG_USER_PROMPTS`. The log record has `prompt_length=45` but no `prompt` attribute. Norbert stores the event with prompt_length only; no content is available. The session timeline shows "Prompt submitted (45 chars)" instead of the actual text.

### UAT Scenarios (BDD)

#### Scenario: User prompt event captured with length

Given Marco Rossi's Claude Code session is sending OTel data
When Marco submits a prompt of 62 characters
And Claude Code sends a claude_code.user_prompt log record with prompt_length=62
Then a UserPrompt event is persisted with session.id matching Marco's session
And the payload contains prompt_length=62

#### Scenario: Prompt content stored when opt-in enabled

Given Marco Rossi has set OTEL_LOG_USER_PROMPTS=1
When Marco submits a prompt "Refactor the authentication module"
And Claude Code sends a claude_code.user_prompt log record with prompt="Refactor the authentication module"
Then the persisted UserPrompt event payload contains the prompt text

#### Scenario: Missing prompt_length drops the log record

Given a claude_code.user_prompt log record arrives without the prompt_length attribute
When the OTLP parser processes the log record
Then no event is persisted
And a warning is logged indicating missing required attribute "prompt_length"

### Acceptance Criteria

- [ ] `UserPrompt` variant added to EventType enum, serializing to "user_prompt"
- [ ] claude_code.user_prompt log records are extracted from ExportLogsServiceRequest
- [ ] prompt_length is a required attribute; missing it drops the log record with warning
- [ ] prompt content is stored when present, omitted when absent (no error)
- [ ] Events are linked to the correct session via session.id
- [ ] prompt.id attribute is preserved for correlating prompts with subsequent api_request events

### Technical Notes

- `prompt.id` (UUID v4) links all events from a single user prompt -- this enables correlating a prompt with its resulting API requests and tool calls
- Prompt content is privacy-sensitive; Norbert stores it only when the user has explicitly opted in via `OTEL_LOG_USER_PROMPTS=1`
- This event type enables future features: prompt timeline, cost-per-prompt analysis, prompt pattern analysis

### JTBD Traceability

- JS-1: Real-time token data delivery (prompt-level context dimension)

### Priority

- MoSCoW: **Should Have** -- enriches session understanding, not required for core cost monitoring
- Value/Effort: Medium Value / Low Effort

### Dependencies

- Depends on: US-COI-001 (OTLP endpoint must exist)
- Depends on: US-COI-004 (EventType enum extension pattern established)

---

## US-COI-007: Ingest Tool Result Events from OTel

### Problem

Ayumi Tanaka is a developer using Claude Code with multiple MCP servers and built-in tools. She finds it difficult to identify which tools are slow or failing because Norbert only shows hook-level tool start/end events without execution details. Claude Code emits `claude_code.tool_result` events via OTel that capture tool execution outcomes including duration, success/failure, error details, and result size.

### Who

- Developer running Norbert | Active Claude Code session with multiple tools/MCP servers | Wants tool performance visibility

### Solution

Extend the OTLP log record parser to recognize `claude_code.tool_result` events. Extract attributes including `tool_name`, `success`, `duration_ms`, `error`, `tool_result_size_bytes`, and tool permission metadata. Persist as a new `ToolResult` event type via the EventStore.

### Domain Examples

#### 1: Happy Path -- Ayumi's file edit tool succeeds

Ayumi's Claude Code session runs the `edit_file` tool to modify `auth.rs`. Claude Code emits a `claude_code.tool_result` log record with `tool_name="edit_file"`, `success=true`, `duration_ms=45`, `tool_result_size_bytes=1200`, `session.id="sess-ayumi-2026-03-20-d4e5f6"`. Norbert persists a `ToolResult` event with the execution details.

#### 2: Edge Case -- MCP server tool with extended metadata

Ayumi's session calls a tool from an MCP server. The log record includes `mcp_server_scope="github-mcp"`, `tool_parameters="{\"repo\": \"norbert\"}"`. Norbert stores these additional attributes in the event payload.

#### 3: Error -- Tool execution fails

Ayumi's session attempts to run `bash` but the tool fails with a permission error. The log record has `success=false`, `error="Permission denied: bash execution blocked by policy"`, `decision_type="deny"`, `decision_source="user_policy"`. Norbert persists the failure event with error details.

### UAT Scenarios (BDD)

#### Scenario: Successful tool result event captured

Given Ayumi Tanaka's Claude Code session is sending OTel data
When Claude Code completes the edit_file tool in 45ms
And Claude Code sends a claude_code.tool_result log record with tool_name="edit_file", success=true, duration_ms=45
Then a ToolResult event is persisted with session.id matching Ayumi's session
And the payload contains tool_name="edit_file", success=true, duration_ms=45

#### Scenario: Failed tool result captured with error details

Given Ayumi Tanaka's Claude Code session is sending OTel data
When Claude Code's bash tool execution fails
And Claude Code sends a claude_code.tool_result log record with tool_name="bash", success=false, error="Permission denied"
Then a ToolResult event is persisted with success=false and the error message

#### Scenario: Missing tool_name drops the log record

Given a claude_code.tool_result log record arrives without the tool_name attribute
When the OTLP parser processes the log record
Then no event is persisted
And a warning is logged indicating missing required attribute "tool_name"

#### Scenario: MCP server metadata preserved

Given Ayumi's session calls a tool from the "github-mcp" MCP server
When Claude Code sends a tool_result log record with mcp_server_scope="github-mcp"
Then the persisted ToolResult event payload includes mcp_server_scope="github-mcp"

### Acceptance Criteria

- [ ] `ToolResult` variant added to EventType enum, serializing to "tool_result"
- [ ] claude_code.tool_result log records are extracted from ExportLogsServiceRequest
- [ ] tool_name is a required attribute; missing it drops the log record with warning
- [ ] success, duration_ms, error, tool_result_size_bytes stored when present
- [ ] MCP metadata (mcp_server_scope, tool_parameters) stored when present
- [ ] Events are linked to the correct session via session.id

### Technical Notes

- `tool_result` events from OTel are richer than existing `ToolCallEnd` hook events -- they include execution duration, result size, and MCP metadata
- `tool_parameters` may contain sensitive data when `OTEL_LOG_TOOL_DETAILS=1` is enabled
- This event type enables future features: tool performance dashboard, slow tool detection, tool failure rate monitoring

### JTBD Traceability

- JS-1: Real-time token data delivery (tool execution visibility dimension)

### Priority

- MoSCoW: **Should Have** -- enriches tool execution monitoring beyond existing hook events
- Value/Effort: Medium Value / Low Effort

### Dependencies

- Depends on: US-COI-001 (OTLP endpoint must exist)
- Depends on: US-COI-004 (EventType enum extension pattern established)

---

## US-COI-008: Ingest API Error Events from OTel

### Problem

Marco Rossi is a developer running long Claude Code sessions. He finds it frustrating when API calls fail silently -- he only notices when output stops appearing in the terminal. Claude Code emits `claude_code.api_error` events via OTel that capture API failures including the error message, HTTP status code, model, duration, and retry attempt number. Without these events, Marco cannot distinguish between "Claude is thinking" and "the API is down."

### Who

- Developer running Norbert | Active Claude Code session | Wants immediate visibility into API failures

### Solution

Extend the OTLP log record parser to recognize `claude_code.api_error` events. Extract attributes including `model`, `error`, `status_code`, `duration_ms`, `attempt`, and `speed`. Persist as a new `ApiError` event type via the EventStore.

### Domain Examples

#### 1: Happy Path -- Rate limit error captured

Marco's Claude Code session hits a rate limit. Claude Code emits a `claude_code.api_error` log record with `model="claude-sonnet-4-20250514"`, `error="rate_limit_exceeded"`, `status_code=429`, `duration_ms=150`, `attempt=1`, `speed="normal"`, `session.id="sess-marco-2026-03-20-a1b2c3"`. Norbert persists an `ApiError` event and the Performance Monitor can display the error.

#### 2: Edge Case -- Retry attempt captured

After the rate limit, Claude Code retries. The second attempt also fails: `attempt=2`, `status_code=429`. Norbert persists a second `ApiError` event. The session timeline shows both attempts.

#### 3: Error -- Server error with no status code

Anthropic's API is unreachable. The log record has `error="connection_timeout"`, `duration_ms=30000`, but no `status_code` attribute (connection never completed). Norbert stores the event with status_code absent.

### UAT Scenarios (BDD)

#### Scenario: API rate limit error captured

Given Marco Rossi's Claude Code session is sending OTel data
When an API call to claude-sonnet-4-20250514 fails with status 429
And Claude Code sends a claude_code.api_error log record with status_code=429, error="rate_limit_exceeded", attempt=1
Then an ApiError event is persisted with session.id matching Marco's session
And the payload contains status_code=429, error="rate_limit_exceeded", model="claude-sonnet-4-20250514"

#### Scenario: Connection timeout with no status code

Given Marco Rossi's Claude Code session is sending OTel data
When an API call times out without receiving a response
And Claude Code sends a claude_code.api_error log record with error="connection_timeout" and no status_code
Then an ApiError event is persisted with error="connection_timeout"
And the status_code field is absent (not zero)

#### Scenario: Missing error attribute drops the log record

Given a claude_code.api_error log record arrives without the error attribute
When the OTLP parser processes the log record
Then no event is persisted
And a warning is logged indicating missing required attribute "error"

### Acceptance Criteria

- [ ] `ApiError` variant added to EventType enum, serializing to "api_error"
- [ ] claude_code.api_error log records are extracted from ExportLogsServiceRequest
- [ ] error is a required attribute; missing it drops the log record with warning
- [ ] status_code, duration_ms, attempt, speed, model stored when present
- [ ] Events are linked to the correct session via session.id

### Technical Notes

- API error events complement api_request events -- together they give a complete picture of API call outcomes
- `attempt` attribute enables retry tracking and failure pattern analysis
- `speed` attribute ("fast" or "normal") indicates which API tier was used
- This event type enables future features: error rate monitoring, API health indicator, retry pattern visualization

### JTBD Traceability

- JS-1: Real-time token data delivery (API reliability visibility dimension)

### Priority

- MoSCoW: **Should Have** -- critical for understanding API failures, not required for core cost monitoring
- Value/Effort: Medium Value / Low Effort

### Dependencies

- Depends on: US-COI-001 (OTLP endpoint must exist)
- Depends on: US-COI-004 (EventType enum extension pattern established)

---

## US-COI-009: Ingest Tool Decision Events from OTel

### Problem

Ayumi Tanaka is a developer who has configured tool permission policies in Claude Code. She finds it opaque when tools are silently blocked or auto-approved -- she cannot tell from the terminal output whether a tool was allowed by her policy, approved interactively, or rejected. Claude Code emits `claude_code.tool_decision` events via OTel that capture the permission decision (`allow`/`deny`) and the source of that decision (`user_policy`, `user_interactive`, `auto`).

### Who

- Developer running Norbert | Active Claude Code session with tool permission policies | Wants visibility into tool permission decisions

### Solution

Extend the OTLP log record parser to recognize `claude_code.tool_decision` events. Extract attributes including `tool_name`, `decision`, and `source`. Persist as a new `ToolDecision` event type via the EventStore.

### Domain Examples

#### 1: Happy Path -- Tool auto-approved by policy

Ayumi's Claude Code session requests to run `edit_file`. Her policy auto-approves it. Claude Code emits a `claude_code.tool_decision` log record with `tool_name="edit_file"`, `decision="allow"`, `source="user_policy"`, `session.id="sess-ayumi-2026-03-20-d4e5f6"`. Norbert persists a `ToolDecision` event.

#### 2: Edge Case -- Tool rejected by user interactively

Claude Code requests to run `bash` and prompts Ayumi for approval. She rejects it. The log record has `tool_name="bash"`, `decision="deny"`, `source="user_interactive"`. Norbert records the rejection.

#### 3: Boundary -- Unknown decision source

A future Claude Code version introduces a new decision source value. The log record has `source="automated_review"`. Norbert stores the value as-is without validation, preserving forward compatibility.

### UAT Scenarios (BDD)

#### Scenario: Tool permission allow captured

Given Ayumi Tanaka's Claude Code session is sending OTel data
When Claude Code auto-approves the edit_file tool via user policy
And Claude Code sends a claude_code.tool_decision log record with tool_name="edit_file", decision="allow", source="user_policy"
Then a ToolDecision event is persisted with session.id matching Ayumi's session
And the payload contains tool_name="edit_file", decision="allow", source="user_policy"

#### Scenario: Tool permission deny captured

Given Ayumi Tanaka's Claude Code session is sending OTel data
When Ayumi rejects a bash tool request interactively
And Claude Code sends a tool_decision log record with tool_name="bash", decision="deny", source="user_interactive"
Then a ToolDecision event is persisted with decision="deny"

#### Scenario: Missing tool_name drops the log record

Given a claude_code.tool_decision log record arrives without the tool_name attribute
When the OTLP parser processes the log record
Then no event is persisted
And a warning is logged indicating missing required attribute "tool_name"

### Acceptance Criteria

- [ ] `ToolDecision` variant added to EventType enum, serializing to "tool_decision"
- [ ] claude_code.tool_decision log records are extracted from ExportLogsServiceRequest
- [ ] tool_name is a required attribute; missing it drops the log record with warning
- [ ] decision and source attributes stored when present
- [ ] Unknown decision/source values are stored as-is (forward compatible)
- [ ] Events are linked to the correct session via session.id

### Technical Notes

- Tool decision events pair with tool_result events -- decision happens before execution, result happens after
- `decision` values documented: "allow", "deny"
- `source` values documented: "user_policy", "user_interactive", "auto"
- Store values as strings, not enums, for forward compatibility with new values
- This event type enables future features: tool permission audit log, policy effectiveness analysis

### JTBD Traceability

- JS-1: Real-time token data delivery (tool permission visibility dimension)

### Priority

- MoSCoW: **Could Have** -- useful for tool governance visibility, lowest priority among new event types
- Value/Effort: Low Value / Low Effort

### Dependencies

- Depends on: US-COI-001 (OTLP endpoint must exist)
- Depends on: US-COI-004 (EventType enum extension pattern established)
