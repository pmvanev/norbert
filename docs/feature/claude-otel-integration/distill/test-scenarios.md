# Acceptance Test Scenarios: Claude Code OTel Integration

**Feature ID**: claude-otel-integration
**Date**: 2026-03-23
**Designer**: Quinn (acceptance-designer)
**Paradigm**: Functional programming
**Test Framework**: Vitest + custom BDD helpers (TypeScript); cargo test (Rust)
**Integration approach**: Real services (axum server + SQLite DB)

---

## Scenario Index

| # | Tag | Scenario | Story | Roadmap Step | Category |
|---|-----|----------|-------|--------------|----------|
| 1 | @walking_skeleton | Developer receives token usage from OTel-enabled session | US-COI-001 | 01-03 | happy |
| 2 | @walking_skeleton | Developer sees OTel-reported cost instead of estimated cost | US-COI-002 | 02-01 | happy |
| 3 | @walking_skeleton | OTel-active session stops duplicate transcript polling | US-COI-003 | 02-02 | happy |
| 4 | | Five new event types persist and round-trip correctly | US-COI-004 | 01-01 | happy |
| 5 | | Token usage attributes extracted from OTel log record | US-COI-001 | 01-02 | happy |
| 6 | | Cache token attributes renamed to canonical field names | US-COI-001 | 01-02 | happy |
| 7 | | Session identity unified between hook and OTel events | US-COI-005 | 01-02 | happy |
| 8 | | OTel event creates session when no hook event preceded it | US-COI-005 | 01-02 | edge |
| 9 | | User prompt event captured with prompt length | US-COI-006 | 01-02 | happy |
| 10 | | Prompt content stored when opt-in enabled | US-COI-006 | 01-02 | edge |
| 11 | | Successful tool result event captured with execution details | US-COI-007 | 01-02 | happy |
| 12 | | Failed tool execution captured with error details | US-COI-007 | 01-02 | error |
| 13 | | Tool result with MCP server metadata preserved | US-COI-007 | 01-02 | edge |
| 14 | | API rate limit error captured with status and attempt | US-COI-008 | 01-02 | happy |
| 15 | | Connection timeout error captured without status code | US-COI-008 | 01-02 | edge |
| 16 | | Tool permission allow decision captured | US-COI-009 | 01-02 | happy |
| 17 | | Tool permission deny decision captured | US-COI-009 | 01-02 | happy |
| 18 | | Non-Claude log records silently ignored | US-COI-001 | 01-03 | edge |
| 19 | | Missing required attribute drops log record gracefully | US-COI-001 | 01-02 | error |
| 20 | | Missing session identity drops log record gracefully | US-COI-005 | 01-02 | error |
| 21 | | Malformed payload rejected with error response | US-COI-001 | 01-03 | error |
| 22 | | Zero cost treated as valid cost, not as missing | US-COI-002 | 02-01 | edge |
| 23 | | Cost falls back to pricing model when OTel cost absent | US-COI-002 | 02-01 | happy |
| 24 | | Non-OTel session continues transcript polling normally | US-COI-003 | 02-02 | happy |
| 25 | | Mixed sessions polled independently | US-COI-003 | 02-02 | edge |
| 26 | | First API request event triggers OTel-active detection | US-COI-003 | 02-02 | edge |
| 27 | @property | Numeric attributes parsed from string values correctly | US-COI-001 | 01-02 | edge |
| 28 | | Unknown event attributes silently ignored | US-COI-001 | 01-02 | edge |
| 29 | | Zero cache tokens mapped as valid zero values | US-COI-001 | 01-02 | edge |
| 30 | | Missing optional attributes produce event with defaults | US-COI-001 | 01-02 | edge |
| 31 | | Multiple log records in single request processed independently | US-COI-001 | 01-03 | edge |
| 32 | | Unknown tool decision values stored as-is for forward compatibility | US-COI-009 | 01-02 | edge |
| 33 | | Existing hook events unaffected by new event types | US-COI-004 | 01-01 | error |

**Counts**: 33 scenarios total. 11 happy path (33%), 4 error path (12%), 18 edge/boundary (55%).
**Error + edge combined**: 22/33 = 67% (exceeds 40% target).
**Walking skeletons**: 3.
**Focused scenarios**: 30.

---

## Feature: OTel Event Ingestion (Backend -- Phase 01)

### Background

```
Given the Norbert hook receiver is running on port 3748
And the event store is empty
```

---

### @walking_skeleton Scenario 1: Developer receives token usage from OTel-enabled session
**Traces**: US-COI-001, Step 01-03

```gherkin
@walking_skeleton
Scenario: Developer receives token usage from OTel-enabled session
  Given Marco's Claude Code session "sess-marco-01" is sending OTel data
  When Claude Code reports an API request using claude-sonnet-4-20250514
    with 1500 input tokens, 800 output tokens, and estimated cost $0.042
  Then an API request event is stored for session "sess-marco-01"
  And the stored event contains 1500 input tokens, 800 output tokens, model "claude-sonnet-4-20250514", and cost $0.042
```

---

### Scenario 4: Five new event types persist and round-trip correctly
**Traces**: US-COI-004, Step 01-01

```gherkin
@property
Scenario: Five new event types persist and round-trip correctly
  Given the domain model includes event types api_request, user_prompt, tool_result, api_error, and tool_decision
  When each event type is serialized and deserialized
  Then each produces the matching snake_case string
  And the six original event types remain unchanged
```

---

### Scenario 5: Token usage attributes extracted from OTel log record
**Traces**: US-COI-001, Step 01-02

```gherkin
Scenario: Token usage attributes extracted from OTel log record
  Given an OTel log record for event "claude_code.api_request"
    with input_tokens "1500", output_tokens "800", model "claude-sonnet-4-20250514"
    and cost_usd "0.042", duration_ms "2504", speed "normal"
    and session.id "sess-extract-01"
  When the log record is ingested
  Then an API request event is stored for session "sess-extract-01"
  And the stored usage contains input_tokens 1500 and output_tokens 800
  And the stored usage contains cost_usd 0.042 and duration_ms 2504
```

---

### Scenario 6: Cache token attributes renamed to canonical field names
**Traces**: US-COI-001, Step 01-02

```gherkin
Scenario: Cache token attributes renamed to canonical field names
  Given an OTel log record for event "claude_code.api_request"
    with cache_read_tokens "500" and cache_creation_tokens "200"
    and input_tokens "1500", output_tokens "800", model "claude-sonnet-4-20250514"
    and session.id "sess-cache-01"
  When the log record is ingested
  Then the stored usage contains cache_read_input_tokens 500
  And the stored usage contains cache_creation_input_tokens 200
```

---

### Scenario 7: Session identity unified between hook and OTel events
**Traces**: US-COI-005, Step 01-02

```gherkin
Scenario: Session identity unified between hook and OTel events
  Given Marco's session "sess-unified-01" started via a hook event
  When an OTel log record arrives with session.id "sess-unified-01"
  Then the OTel event is stored under session "sess-unified-01"
  And both hook and OTel events appear in the same session view
```

---

### Scenario 8: OTel event creates session when no hook event preceded it
**Traces**: US-COI-005, Step 01-02

```gherkin
Scenario: OTel event creates session when no hook event preceded it
  Given no session exists for "sess-otel-first-01"
  When an OTel API request log record arrives with session.id "sess-otel-first-01"
  Then a session is created with id "sess-otel-first-01"
  And the API request event is stored for that session
```

---

### Scenario 9: User prompt event captured with prompt length
**Traces**: US-COI-006, Step 01-02

```gherkin
Scenario: User prompt event captured with prompt length
  Given an OTel log record for event "claude_code.user_prompt"
    with prompt_length "62" and session.id "sess-prompt-01"
  When the log record is ingested
  Then a user prompt event is stored for session "sess-prompt-01"
  And the stored payload contains prompt_length 62
```

---

### Scenario 10: Prompt content stored when opt-in enabled
**Traces**: US-COI-006, Step 01-02

```gherkin
Scenario: Prompt content stored when opt-in enabled
  Given an OTel log record for event "claude_code.user_prompt"
    with prompt_length "34" and prompt "Refactor the authentication module"
    and session.id "sess-prompt-opt-01"
  When the log record is ingested
  Then the stored user prompt payload contains content "Refactor the authentication module"
```

---

### Scenario 11: Successful tool result event captured with execution details
**Traces**: US-COI-007, Step 01-02

```gherkin
Scenario: Successful tool result event captured with execution details
  Given an OTel log record for event "claude_code.tool_result"
    with tool_name "edit_file", success "true", duration_ms "45"
    and session.id "sess-tool-01"
  When the log record is ingested
  Then a tool result event is stored for session "sess-tool-01"
  And the stored payload contains tool_name "edit_file", success true, and duration 45ms
```

---

### Scenario 12: Failed tool execution captured with error details
**Traces**: US-COI-007, Step 01-02

```gherkin
Scenario: Failed tool execution captured with error details
  Given an OTel log record for event "claude_code.tool_result"
    with tool_name "bash", success "false", error "Permission denied"
    and session.id "sess-tool-fail-01"
  When the log record is ingested
  Then a tool result event is stored with success false
  And the stored payload contains error "Permission denied"
```

---

### Scenario 13: Tool result with MCP server metadata preserved
**Traces**: US-COI-007, Step 01-02

```gherkin
Scenario: Tool result with MCP server metadata preserved
  Given an OTel log record for event "claude_code.tool_result"
    with tool_name "github_search", mcp_server_scope "github-mcp"
    and session.id "sess-mcp-01"
  When the log record is ingested
  Then the stored tool result payload contains mcp_server_scope "github-mcp"
```

---

### Scenario 14: API rate limit error captured with status and attempt
**Traces**: US-COI-008, Step 01-02

```gherkin
Scenario: API rate limit error captured with status and attempt
  Given an OTel log record for event "claude_code.api_error"
    with error "rate_limit_exceeded", status_code "429", attempt "1"
    and model "claude-sonnet-4-20250514"
    and session.id "sess-error-01"
  When the log record is ingested
  Then an API error event is stored for session "sess-error-01"
  And the stored payload contains error "rate_limit_exceeded", status_code 429, and attempt 1
```

---

### Scenario 15: Connection timeout error captured without status code
**Traces**: US-COI-008, Step 01-02

```gherkin
Scenario: Connection timeout error captured without status code
  Given an OTel log record for event "claude_code.api_error"
    with error "connection_timeout" and duration_ms "30000"
    and no status_code attribute
    and session.id "sess-timeout-01"
  When the log record is ingested
  Then an API error event is stored with error "connection_timeout"
  And the stored payload has no status_code field
```

---

### Scenario 16: Tool permission allow decision captured
**Traces**: US-COI-009, Step 01-02

```gherkin
Scenario: Tool permission allow decision captured
  Given an OTel log record for event "claude_code.tool_decision"
    with tool_name "edit_file", decision "allow", source "user_policy"
    and session.id "sess-decision-01"
  When the log record is ingested
  Then a tool decision event is stored for session "sess-decision-01"
  And the stored payload contains tool_name "edit_file", decision "allow", source "user_policy"
```

---

### Scenario 17: Tool permission deny decision captured
**Traces**: US-COI-009, Step 01-02

```gherkin
Scenario: Tool permission deny decision captured
  Given an OTel log record for event "claude_code.tool_decision"
    with tool_name "bash", decision "deny", source "user_interactive"
    and session.id "sess-deny-01"
  When the log record is ingested
  Then a tool decision event is stored with decision "deny"
```

---

### Scenario 18: Non-Claude log records silently ignored
**Traces**: US-COI-001, Step 01-03

```gherkin
Scenario: Non-Claude log records silently ignored
  Given an OTel log export containing log records
    with event names "http.request" and "db.query" (no claude_code prefix)
  When the log export is sent to the ingestion endpoint
  Then the receiver responds with success
  And no events are stored
```

---

### Scenario 19: Missing required attribute drops log record gracefully
**Traces**: US-COI-001, Step 01-02

```gherkin
Scenario: Missing required attribute drops log record gracefully
  Given an OTel log record for event "claude_code.api_request"
    with input_tokens "1500" and model "claude-sonnet-4-20250514"
    but missing output_tokens
    and session.id "sess-missing-01"
  When the log record is ingested
  Then no API request event is stored for session "sess-missing-01"
  And the receiver responds with success
```

---

### Scenario 20: Missing session identity drops log record gracefully
**Traces**: US-COI-005, Step 01-02

```gherkin
Scenario: Missing session identity drops log record gracefully
  Given an OTel log record for event "claude_code.api_request"
    with input_tokens "1500", output_tokens "800", model "claude-sonnet-4-20250514"
    but missing session.id
  When the log record is ingested
  Then no event is stored
  And the receiver responds with success
```

---

### Scenario 21: Malformed payload rejected with error response
**Traces**: US-COI-001, Step 01-03

```gherkin
Scenario: Malformed payload rejected with error response
  Given the ingestion endpoint receives a request with body "not valid json"
  When the request is processed
  Then the receiver responds with a client error
  And no events are stored
```

---

### Scenario 27: Numeric attributes parsed from string values correctly
**Traces**: US-COI-001, Step 01-02

```gherkin
@property
Scenario: Numeric attributes parsed from string values correctly
  Given any OTel log record where numeric attributes arrive as string values
    such as input_tokens "337", cost_usd "0.144065", success "true"
  When the attributes are parsed
  Then input_tokens is extracted as integer 337
  And cost_usd is extracted as decimal 0.144065
  And success is extracted as boolean true
```

---

### Scenario 28: Unknown event attributes silently ignored
**Traces**: US-COI-001, Step 01-02

```gherkin
Scenario: Unknown event attributes silently ignored
  Given an OTel log record for event "claude_code.api_request"
    with all required attributes plus unknown attribute "future_field" = "new_data"
    and session.id "sess-unknown-attr-01"
  When the log record is ingested
  Then an API request event is stored successfully
  And the unknown attribute does not cause an error
```

---

### Scenario 29: Zero cache tokens mapped as valid zero values
**Traces**: US-COI-001, Step 01-02

```gherkin
Scenario: Zero cache tokens mapped as valid zero values
  Given an OTel log record for event "claude_code.api_request"
    with cache_read_tokens "0" and cache_creation_tokens "0"
    and input_tokens "1500", output_tokens "800", model "claude-sonnet-4-20250514"
    and session.id "sess-zero-cache-01"
  When the log record is ingested
  Then the stored usage contains cache_read_input_tokens 0
  And the stored usage contains cache_creation_input_tokens 0
```

---

### Scenario 30: Missing optional attributes produce event with defaults
**Traces**: US-COI-001, Step 01-02

```gherkin
Scenario: Missing optional attributes produce event with defaults
  Given an OTel log record for event "claude_code.api_request"
    with only required attributes input_tokens "100", output_tokens "50", model "claude-sonnet-4-20250514"
    and no cost_usd, duration_ms, speed, or cache token attributes
    and session.id "sess-minimal-01"
  When the log record is ingested
  Then an API request event is stored with input_tokens 100 and output_tokens 50
  And the stored usage has cache_read_input_tokens defaulting to 0
```

---

### Scenario 31: Multiple log records in single request processed independently
**Traces**: US-COI-001, Step 01-03

```gherkin
Scenario: Multiple log records in single request processed independently
  Given an OTel log export containing three log records:
    an API request for session "sess-multi-01",
    a user prompt for session "sess-multi-01",
    and an API request missing output_tokens for session "sess-multi-01"
  When the log export is sent to the ingestion endpoint
  Then the valid API request event is stored
  And the valid user prompt event is stored
  And the invalid log record is dropped
  And the receiver responds with success
```

---

### Scenario 32: Unknown tool decision values stored as-is for forward compatibility
**Traces**: US-COI-009, Step 01-02

```gherkin
Scenario: Unknown tool decision values stored as-is for forward compatibility
  Given an OTel log record for event "claude_code.tool_decision"
    with tool_name "bash", decision "escalate", source "automated_review"
    and session.id "sess-compat-01"
  When the log record is ingested
  Then a tool decision event is stored with decision "escalate" and source "automated_review"
```

---

### Scenario 33: Existing hook events unaffected by new event types
**Traces**: US-COI-004, Step 01-01

```gherkin
Scenario: Existing hook events unaffected by new event types
  Given a hook event of type "PreToolUse" with session_id "sess-hook-01"
  When the hook event is received
  Then a tool call start event is stored for session "sess-hook-01"
  And the hook endpoint continues to function as before
```

---

## Feature: OTel Cost and Polling (Frontend -- Phase 02)

### @walking_skeleton Scenario 2: Developer sees OTel-reported cost instead of estimated cost
**Traces**: US-COI-002, Step 02-01

```gherkin
@walking_skeleton
Scenario: Developer sees OTel-reported cost instead of estimated cost
  Given Marco's session has been processing API requests
  When an API request event arrives with cost_usd $0.042
  Then Marco's session cost increases by exactly $0.042
  And the local pricing estimate is not used for this event
```

---

### @walking_skeleton Scenario 3: OTel-active session stops duplicate transcript polling
**Traces**: US-COI-003, Step 02-02

```gherkin
@walking_skeleton
Scenario: OTel-active session stops duplicate transcript polling
  Given Marco's session "sess-otel-poll-01" has received 3 API request events via OTel
  When the transcript polling cycle runs
  Then transcript polling is skipped for session "sess-otel-poll-01"
  And Marco's token counts are not duplicated
```

---

### Scenario 22: Zero cost treated as valid cost, not as missing
**Traces**: US-COI-002, Step 02-01

```gherkin
Scenario: Zero cost treated as valid cost, not as missing
  Given an API request event with cost_usd $0.00
    and 500 cache_read_input_tokens (fully cached response)
  When the metrics aggregator processes the event
  Then the session cost increases by $0.00
  And the event is not treated as missing cost data
```

---

### Scenario 23: Cost falls back to pricing model when OTel cost absent
**Traces**: US-COI-002, Step 02-01

```gherkin
Scenario: Cost falls back to pricing model when OTel cost absent
  Given a token usage event from transcript polling
    with 1500 input tokens, 800 output tokens, model "claude-sonnet-4-20250514"
    and no cost_usd value
  When the metrics aggregator processes the event
  Then the session cost is calculated using the local pricing model
```

---

### Scenario 24: Non-OTel session continues transcript polling normally
**Traces**: US-COI-003, Step 02-02

```gherkin
Scenario: Non-OTel session continues transcript polling normally
  Given Ayumi's session "sess-ayumi-poll-01" has received zero API request events
  And her transcript file is available
  When the transcript polling cycle runs
  Then the transcript poller reads Ayumi's session data
  And token data from the transcript appears in the session metrics
```

---

### Scenario 25: Mixed sessions polled independently
**Traces**: US-COI-003, Step 02-02

```gherkin
Scenario: Mixed sessions polled independently
  Given Marco's session "sess-marco-mix-01" is receiving OTel data
  And Ayumi's session "sess-ayumi-mix-01" is using transcript polling
  When both sessions are active simultaneously
  Then Marco's metrics come exclusively from OTel events
  And Ayumi's metrics come exclusively from transcript polling
```

---

### Scenario 26: First API request event triggers OTel-active detection
**Traces**: US-COI-003, Step 02-02

```gherkin
Scenario: First API request event triggers OTel-active detection
  Given Marco's new session "sess-new-detect-01" has been using transcript polling
  When the first API request event arrives via OTel for that session
  Then the session is marked as OTel-active
  And subsequent transcript polling cycles skip that session
```

---

## Implementation Sequence

Enable one scenario at a time, in this order:

### Phase 01: Backend (Rust)

1. **Scenario 4** -- Event type round-trip (domain model foundation)
2. **Scenario 33** -- Existing hooks unaffected (regression guard)
3. **Scenario 27** -- String-to-typed attribute parsing (@property)
4. **Scenario 5** -- Token usage extraction
5. **Scenario 6** -- Cache token rename
6. **Scenario 29** -- Zero cache tokens
7. **Scenario 30** -- Missing optional attributes
8. **Scenario 28** -- Unknown attributes ignored
9. **Scenario 9** -- User prompt extraction
10. **Scenario 10** -- Prompt content opt-in
11. **Scenario 11** -- Tool result success
12. **Scenario 12** -- Tool result failure
13. **Scenario 13** -- MCP metadata
14. **Scenario 14** -- API error with status
15. **Scenario 15** -- API error without status
16. **Scenario 16** -- Tool decision allow
17. **Scenario 17** -- Tool decision deny
18. **Scenario 32** -- Forward-compatible decision values
19. **Scenario 7** -- Session identity unification
20. **Scenario 8** -- OTel-first session creation
21. **Scenario 20** -- Missing session.id drops record
22. **Scenario 19** -- Missing required attribute drops record
23. **Scenario 1** -- Walking skeleton: full ingestion E2E
24. **Scenario 18** -- Non-Claude records ignored
25. **Scenario 21** -- Malformed JSON rejected
26. **Scenario 31** -- Multiple records in single request

### Phase 02: Frontend (TypeScript)

27. **Scenario 2** -- Walking skeleton: OTel cost display
28. **Scenario 22** -- Zero cost valid
29. **Scenario 23** -- Pricing model fallback
30. **Scenario 3** -- Walking skeleton: polling suppression
31. **Scenario 24** -- Non-OTel session polling
32. **Scenario 25** -- Mixed sessions
33. **Scenario 26** -- OTel-active detection trigger

---

## Story-to-Scenario Coverage Matrix

| User Story | Scenarios | Count |
|-----------|-----------|-------|
| US-COI-001 | 1, 5, 6, 18, 19, 21, 27, 28, 29, 30, 31 | 11 |
| US-COI-002 | 2, 22, 23 | 3 |
| US-COI-003 | 3, 24, 25, 26 | 4 |
| US-COI-004 | 4, 33 | 2 |
| US-COI-005 | 7, 8, 20 | 3 |
| US-COI-006 | 9, 10 | 2 |
| US-COI-007 | 11, 12, 13 | 3 |
| US-COI-008 | 14, 15 | 2 |
| US-COI-009 | 16, 17, 32 | 3 |

All 9 stories covered. All acceptance criteria from each story have at least one corresponding scenario.

---

## Driving Port Mapping

### Backend (Rust) -- Phase 01

All backend scenarios invoke through:
- **HTTP endpoint**: `POST /v1/logs` on the axum handler in `hook_receiver.rs`
- **EventStore.write_event()**: for persistence verification
- **EventStore.get_events_for_session()**: for stored event assertions

Step definitions delegate to the running axum server (real HTTP) and query SQLite (real DB).

### Frontend (TypeScript) -- Phase 02

All frontend scenarios invoke through:
- **aggregateEvent()**: the pure fold function in `metricsAggregator.ts`
- **Transcript polling logic**: the effect boundary in `App.tsx`

Step definitions call the public `aggregateEvent` function directly with test event data.

### Not Tested Directly (Internal Components)

- `otlp_parser` module (exercised indirectly through HTTP endpoint)
- `event_extractors` functions (exercised indirectly through HTTP endpoint)
- `attribute_mapper` function (exercised indirectly through HTTP endpoint)
- `tokenExtractor.ts` (exercised indirectly through `aggregateEvent`)
- `pricingModel.ts` (exercised indirectly through `aggregateEvent`)
