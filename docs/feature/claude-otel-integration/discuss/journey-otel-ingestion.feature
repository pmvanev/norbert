Feature: OTel Data Ingestion
  As a developer running Norbert alongside Claude Code,
  I want real-time token usage and cost data via OpenTelemetry,
  so that the Performance Monitor shows live, accurate metrics
  instead of delayed data from transcript file polling.

  Background:
    Given Norbert is running with the hook receiver on port 3748

  # --- Step 1: Enable OTel Telemetry ---

  Scenario: OTel enablement via environment variables
    Given Marco Rossi has Claude Code installed on his development machine
    When Marco sets CLAUDE_CODE_ENABLE_TELEMETRY=1
    And Marco sets OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748
    And Marco starts a new Claude Code session
    Then Claude Code begins exporting OTel trace data to Norbert

  Scenario: Claude Code works normally without OTel configured
    Given Ayumi Tanaka has Claude Code installed
    And she has not set any OTel environment variables
    When Ayumi starts a new Claude Code session
    Then Claude Code operates normally without sending OTel data
    And Norbert continues monitoring via transcript polling

  # --- Step 2: Receive OTLP Trace Data ---

  Scenario: OTLP HTTP endpoint receives trace data
    Given Marco Rossi's Claude Code session is exporting OTel data
    When Claude Code completes an API request to claude-sonnet-4-20250514
    And Claude Code sends a POST to /v1/traces with an ExportTraceServiceRequest
    Then the hook receiver responds with 200 OK
    And the claude_code.api_request span is accepted for processing

  Scenario: Non-Claude Code spans are silently ignored
    Given an OTLP client sends a POST to /v1/traces
    And the request contains spans named "http.request" with no claude_code.api_request spans
    When the hook receiver processes the request
    Then the hook receiver responds with 200 OK
    And no events are persisted to the EventStore

  Scenario: Malformed OTLP payload returns error
    Given an OTLP client sends a POST to /v1/traces
    And the request body is not valid ExportTraceServiceRequest JSON
    When the hook receiver processes the request
    Then the hook receiver responds with 400 Bad Request
    And a warning is logged with the parse error details

  # --- Step 3: Extract Token Usage from OTel Span ---

  Scenario: Complete token usage extracted from span attributes
    Given the OTLP parser has received a claude_code.api_request span
    And the span has attribute input_tokens with integer value 1500
    And the span has attribute output_tokens with integer value 800
    And the span has attribute cache_read_tokens with integer value 500
    And the span has attribute cache_creation_tokens with integer value 200
    And the span has attribute cost_usd with double value 0.042
    And the span has attribute model with string value "claude-sonnet-4-20250514"
    When the parser extracts token usage
    Then the canonical payload contains usage.input_tokens = 1500
    And usage.output_tokens = 800
    And usage.cache_read_input_tokens = 500
    And usage.cache_creation_input_tokens = 200
    And usage.cost_usd = 0.042
    And usage.model = "claude-sonnet-4-20250514"

  Scenario: Span with missing required attributes is dropped
    Given the OTLP parser has received a claude_code.api_request span
    And the span has attribute input_tokens with integer value 1500
    But the span is missing the output_tokens attribute
    When the parser attempts to extract token usage
    Then no event is persisted for this span
    And a warning is logged indicating missing required attribute "output_tokens"

  Scenario: Zero-value cache tokens are valid
    Given the OTLP parser has received a claude_code.api_request span
    And the span has attribute cache_read_tokens with integer value 0
    And the span has attribute cache_creation_tokens with integer value 0
    When the parser extracts token usage
    Then the canonical payload contains usage.cache_read_input_tokens = 0
    And usage.cache_creation_input_tokens = 0

  # --- Step 4: Persist as Canonical Event ---

  Scenario: OTel event persisted with ApiRequest event type
    Given the OTLP parser has extracted valid token usage
    And the span belongs to session "sess-marco-2026-03-20-a1b2c3"
    When the event is persisted to the EventStore
    Then a new Event record exists with event_type "api_request"
    And provider "claude_code"
    And session_id "sess-marco-2026-03-20-a1b2c3"
    And the payload contains the canonical usage fields

  Scenario: ApiRequest event increments session event count
    Given session "sess-marco-2026-03-20-a1b2c3" has 5 existing events
    When a new ApiRequest event is persisted for that session
    Then the session event_count is 6
    And the session last_event_at is updated to the current timestamp

  Scenario: OTel event creates session if none exists
    Given no session exists with id "sess-new-otel-session"
    When an ApiRequest event arrives for session "sess-new-otel-session"
    Then a new session is created with id "sess-new-otel-session"
    And the session started_at is set to the event received_at
    And the ApiRequest event is persisted under that session

  # --- Step 5: Frontend Picks Up OTel-Sourced Events ---

  Scenario: Real-time chart update from OTel data
    Given Marco Rossi is viewing the Norbert Performance Monitor
    And his Claude Code session "sess-marco-2026-03-20-a1b2c3" is sending OTel data
    When Claude Code completes an API request using 1500 input tokens and 800 output tokens
    Then the token rate chart in the oscilloscope updates within 500 milliseconds
    And the total tokens metric card reflects the new cumulative total

  Scenario: Authoritative cost from cost_usd overrides pricing model estimate
    Given Marco Rossi's session has received an ApiRequest event
    And the event payload contains cost_usd = 0.042
    When the metricsAggregator processes the event
    Then the session cost increases by exactly $0.042
    And the cost is not recalculated using the local pricing table

  Scenario: Pricing model used when cost_usd is absent
    Given Ayumi Tanaka's session has received an ApiRequest event via transcript polling
    And the event payload does not contain cost_usd
    And the model is "claude-sonnet-4-20250514" with 1500 input tokens and 800 output tokens
    When the metricsAggregator processes the event
    Then the session cost is calculated using the local pricing model
    And the pricing model rates for claude-sonnet-4-20250514 are applied

  # --- Step 6: Graceful Fallback ---

  Scenario: OTel suppresses transcript polling for active session
    Given Marco Rossi has OTel enabled for his Claude Code session
    And session "sess-marco-2026-03-20-a1b2c3" has received 3 ApiRequest events via OTel
    When the transcript polling timer fires
    Then the transcript poller skips session "sess-marco-2026-03-20-a1b2c3"
    And no duplicate token data appears in the metrics

  Scenario: Transcript polling continues for non-OTel sessions
    Given Ayumi Tanaka has not enabled OTel for her Claude Code session
    And session "sess-ayumi-2026-03-20-d4e5f6" is active with a transcript file
    When the transcript polling timer fires
    Then the transcript poller reads Ayumi's transcript JSONL file
    And token data appears in the Performance Monitor

  Scenario: Mixed sessions handled independently
    Given Marco Rossi's session is receiving OTel data (otelActive = true)
    And Ayumi Tanaka's session is using transcript polling (otelActive = false)
    When both sessions are active simultaneously
    Then Marco's session receives data via OTel only
    And Ayumi's session receives data via transcript polling only
    And both sessions display correctly in the Performance Monitor

  # --- Error Paths ---

  Scenario: Norbert starts after Claude Code session already running
    Given Marco Rossi started a Claude Code session 5 minutes ago with OTel enabled
    And Norbert was not running at session start
    When Norbert starts and the hook receiver begins listening on port 3748
    Then subsequent OTel spans from Marco's session are received
    And token data from before Norbert started is not available
    And the Performance Monitor shows data from the point Norbert started

  Scenario: OTLP endpoint coexists with hook endpoint
    Given Norbert hook receiver is listening on port 3748
    When Claude Code sends a hook POST to /hooks/PreToolUse
    And Claude Code sends an OTLP POST to /v1/traces
    Then both requests are processed independently
    And hook events are persisted as ToolCallStart
    And OTel events are persisted as ApiRequest

  @property
  Scenario: OTel data delivery latency
    Given Claude Code is configured to send OTel data to Norbert
    And the Performance Monitor is open
    Then token data from each API request appears in the charts within 500ms of the API response
    And the data delivery latency is consistently below 1 second
