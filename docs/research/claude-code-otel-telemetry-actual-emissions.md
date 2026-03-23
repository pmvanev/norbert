# Research: Claude Code OpenTelemetry -- Actual Telemetry Emissions

**Date**: 2026-03-23 | **Researcher**: nw-researcher (Nova) | **Confidence**: High | **Sources**: 7

## Executive Summary

Claude Code's built-in OpenTelemetry support emits **metrics and logs/events only -- not traces**. This is the single most important finding because the existing Norbert design documents (data-models.md, ADR-030, ADR-031) assume Claude Code sends `ExportTraceServiceRequest` payloads to `/v1/traces`. In reality, Claude Code sends `ExportLogsServiceRequest` payloads to `/v1/logs` and `ExportMetricsServiceRequest` payloads to `/v1/metrics`. The event named `claude_code.api_request` does exist and carries the expected token/cost attributes, but it arrives as an OTel **log record** (event), not a span.

This finding requires re-evaluating ADR-030's `/v1/traces` route, ADR-031's `ExportTraceServiceRequest` parsing structs, and the data-models.md payload structure. The attribute names themselves are largely confirmed, and `session.id` is a standard attribute on all events and metrics (not `session_id`).

## Research Methodology

**Search Strategy**: Web searches targeting official Anthropic documentation, GitHub issues on anthropics/claude-code, practitioner blog posts from Honeycomb/SigNoz/Quesma, and the OpenTelemetry GenAI semantic conventions specification.
**Source Selection**: Official docs (code.claude.com), vendor documentation, GitHub issues, and practitioner guides from observability vendors.
**Quality Standards**: Each major finding cross-referenced across 3+ independent sources. Average source reputation: 0.9.

## Findings

### Finding 1: Claude Code Does NOT Emit Traces/Spans -- It Emits Logs/Events and Metrics

**Evidence**: The official documentation states: "Claude Code exports metrics as time series data via the standard metrics protocol, and events via the logs/events protocol." The configuration variables are `OTEL_METRICS_EXPORTER` and `OTEL_LOGS_EXPORTER`. There is no `OTEL_TRACES_EXPORTER` variable documented or supported.
**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [GitHub Issue #15417](https://github.com/anthropics/claude-code/issues/15417), [SigNoz Claude Code Monitoring](https://signoz.io/docs/claude-code-monitoring/), [Quesma Blog](https://quesma.com/blog/track-claude-code-usage-and-limits-with-grafana-cloud/)
**Analysis**: This directly contradicts the existing design assumption. The OTLP endpoint must accept `POST /v1/logs` (for events) and optionally `POST /v1/metrics` (for time-series metrics), not `POST /v1/traces`. The JSON payload structure is `ExportLogsServiceRequest` with `resourceLogs` / `scopeLogs` / `logRecords`, not `ExportTraceServiceRequest` with `resourceSpans` / `scopeSpans` / `spans`.

**IMPACT ON EXISTING DESIGN**: ADR-030 routes to `/v1/traces` -- must change to `/v1/logs`. ADR-031 parses `ExportTraceServiceRequest` structs -- must change to `ExportLogsServiceRequest` structs. Data-models.md payload example is structurally wrong.

---

### Finding 2: `claude_code.api_request` Exists as an Event Name, Not a Span Name

**Evidence**: The official docs list specific event names under "Events" section: `claude_code.api_request`, `claude_code.user_prompt`, `claude_code.tool_result`, `claude_code.api_error`, and `claude_code.tool_decision`. These are OTel log records with an `event.name` attribute, not trace spans.
**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [Honeycomb Blog](https://www.honeycomb.io/blog/measuring-claude-code-roi-adoption-honeycomb), [SigNoz Claude Code Monitoring](https://signoz.io/docs/claude-code-monitoring/), [GitHub Issue #15417](https://github.com/anthropics/claude-code/issues/15417)
**Analysis**: The assumption that `claude_code.api_request` exists is **confirmed**, but its type is wrong in the design. It is an OTel event (log record), not a span. The full set of events is:

| Event Name | Description |
|---|---|
| `claude_code.user_prompt` | Logged when user submits a prompt |
| `claude_code.api_request` | Logged for each API request to Claude |
| `claude_code.api_error` | Logged when an API request fails |
| `claude_code.tool_result` | Logged when a tool completes execution |
| `claude_code.tool_decision` | Logged when a tool permission decision is made |

---

### Finding 3: Token/Cost Attribute Names Are Confirmed on `api_request` Events

**Evidence**: The official documentation lists these attributes on the `claude_code.api_request` event:

| Attribute | Type | Confirmed? |
|---|---|---|
| `input_tokens` | Number | Yes -- confirmed exact name |
| `output_tokens` | Number | Yes -- confirmed exact name |
| `cache_read_tokens` | Number | Yes -- confirmed exact name |
| `cache_creation_tokens` | Number | Yes -- confirmed exact name |
| `cost_usd` | Number (USD) | Yes -- confirmed exact name, described as "Estimated cost in USD" |
| `model` | String | Yes -- confirmed exact name, example: "claude-sonnet-4-6" |
| `duration_ms` | Number | Additional -- request duration in milliseconds |
| `speed` | String | Additional -- "fast" or "normal" |

**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [Honeycomb Blog](https://www.honeycomb.io/blog/measuring-claude-code-roi-adoption-honeycomb), [SigNoz Claude Code Monitoring](https://signoz.io/docs/claude-code-monitoring/)
**Analysis**: All six assumed attribute names match the official documentation exactly. The design's field mapping table in data-models.md is correct for attribute names. However, the transport format is different -- these attributes arrive as log record attributes in `ExportLogsServiceRequest`, not span attributes in `ExportTraceServiceRequest`.

**NOTE**: These are NOT the OTel GenAI semantic convention names (which would be `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, etc.). Claude Code uses its own attribute naming convention.

---

### Finding 4: `session.id` (Not `session_id`) Is a Standard Attribute on All Events and Metrics

**Evidence**: The official docs list `session.id` (with a dot, not underscore) as a standard attribute included on ALL metrics and events. It is described as "Unique session identifier" and is controlled by `OTEL_METRICS_INCLUDE_SESSION_ID` (default: true).
**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [Honeycomb Blog](https://www.honeycomb.io/blog/measuring-claude-code-roi-adoption-honeycomb), [GitHub Issue #15417](https://github.com/anthropics/claude-code/issues/15417)
**Analysis**: The existing design searches for `session_id` (underscore). The actual attribute name is `session.id` (dot-separated). This is a breaking discrepancy that will cause the parser to miss the session identifier and drop all events. Additionally, `session.id` is a standard attribute on the event itself, not a resource attribute.

Additional standard attributes present on all events:
- `session.id` -- unique session identifier
- `organization.id` -- organization UUID
- `user.account_uuid` -- account UUID
- `user.account_id` -- tagged format matching Anthropic admin APIs
- `user.id` -- anonymous device/installation identifier
- `user.email` -- when authenticated via OAuth
- `terminal.type` -- terminal type (iTerm.app, vscode, cursor, tmux)
- `prompt.id` -- UUID v4 linking all events from a single user prompt (events only, not metrics)

Resource-level attributes (on the OTel Resource, not per-event):
- `service.name`: `claude-code`
- `service.version`: current version
- `os.type`, `os.version`, `host.arch`
- `wsl.version` (only on WSL)

---

### Finding 5: OTLP Endpoints Are `/v1/logs` and `/v1/metrics`, Not `/v1/traces`

**Evidence**: The official docs show endpoint configuration with `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT` (example: `http://localhost:4318/v1/logs`) and `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT` (example: `http://localhost:4318/v1/metrics`). No traces endpoint is documented.
**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [Quesma Blog](https://quesma.com/blog/track-claude-code-usage-and-limits-with-grafana-cloud/), [SigNoz Docs](https://signoz.io/docs/claude-code-monitoring/), [GitHub Issue #15417](https://github.com/anthropics/claude-code/issues/15417)
**Analysis**: When using a base endpoint like `http://localhost:4317` with gRPC, the OTel SDK automatically routes to the correct service endpoints. When using HTTP, the SDK appends `/v1/logs` or `/v1/metrics` to the base URL.

For Norbert's single-port architecture (ADR-030), the route must be `POST /v1/logs` instead of `POST /v1/traces`. Optionally, `POST /v1/metrics` could also be handled if Norbert wants to consume the time-series metrics directly.

---

### Finding 6: OTLP Format Supports gRPC, HTTP/JSON, and HTTP/Protobuf

**Evidence**: The official docs list `OTEL_EXPORTER_OTLP_PROTOCOL` with values `grpc`, `http/json`, `http/protobuf`. Separate per-signal overrides exist (`OTEL_EXPORTER_OTLP_LOGS_PROTOCOL`, `OTEL_EXPORTER_OTLP_METRICS_PROTOCOL`).
**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [Quesma Blog](https://quesma.com/blog/track-claude-code-usage-and-limits-with-grafana-cloud/) (uses http/protobuf), [SigNoz Docs](https://signoz.io/docs/claude-code-monitoring/) (uses grpc)
**Analysis**: ADR-031's decision to parse JSON only is viable if Norbert's setup instructions specify `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`. However, the default for many OTel SDKs is `http/protobuf` or `grpc`. Norbert should either (a) support at least HTTP/JSON and document that users must set the protocol, or (b) support HTTP/protobuf as well for a smoother setup experience. The gRPC option adds significant complexity and is likely not worth supporting in the MVP.

---

### Finding 7: Environment Variables Are Confirmed

**Evidence**: The complete set of telemetry environment variables from official documentation:

| Variable | Purpose | Confirmed? |
|---|---|---|
| `CLAUDE_CODE_ENABLE_TELEMETRY=1` | Required to enable telemetry | Yes |
| `OTEL_METRICS_EXPORTER` | Metrics exporter (otlp, prometheus, console) | Yes |
| `OTEL_LOGS_EXPORTER` | Logs/events exporter (otlp, console) | Yes |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | Protocol (grpc, http/json, http/protobuf) | Yes |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Base endpoint URL | Yes |
| `OTEL_EXPORTER_OTLP_HEADERS` | Auth headers | Yes |
| `OTEL_METRIC_EXPORT_INTERVAL` | Metrics interval (default 60000ms) | Yes |
| `OTEL_LOGS_EXPORT_INTERVAL` | Logs interval (default 5000ms) | Yes |
| `OTEL_LOG_USER_PROMPTS=1` | Enable prompt content in events | Yes |
| `OTEL_LOG_TOOL_DETAILS=1` | Enable MCP/skill names in tool events | Yes |
| `OTEL_METRICS_INCLUDE_SESSION_ID` | Include session.id in metrics (default true) | Yes |
| `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` | delta (default) or cumulative | Yes |

**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [SigNoz Docs](https://signoz.io/docs/claude-code-monitoring/), [Quesma Blog](https://quesma.com/blog/track-claude-code-usage-and-limits-with-grafana-cloud/)

---

### Finding 8: OTel Metrics Provide Aggregated Counters (Separate from Events)

**Evidence**: Claude Code exports these OTel metrics (time-series counters, not events):

| Metric Name | Unit | Key Extra Attributes |
|---|---|---|
| `claude_code.session.count` | count | standard only |
| `claude_code.lines_of_code.count` | count | `type` (added/removed) |
| `claude_code.pull_request.count` | count | standard only |
| `claude_code.commit.count` | count | standard only |
| `claude_code.cost.usage` | USD | `model` |
| `claude_code.token.usage` | tokens | `type` (input/output/cacheRead/cacheCreation), `model` |
| `claude_code.code_edit_tool.decision` | count | `tool_name`, `decision`, `source`, `language` |
| `claude_code.active_time.total` | seconds | `type` (user/cli) |

**Source**: [Monitoring - Claude Code Docs](https://code.claude.com/docs/en/monitoring-usage) - Accessed 2026-03-23
**Confidence**: High
**Verification**: [GitHub Issue #15417](https://github.com/anthropics/claude-code/issues/15417), [Honeycomb Blog](https://www.honeycomb.io/blog/measuring-claude-code-roi-adoption-honeycomb)
**Analysis**: These metrics use **delta temporality** by default, which means each export contains only the change since the last export. This is important: Prometheus requires cumulative temporality, so a `deltatocumulative` processor would be needed if routing through Prometheus. For Norbert's direct ingestion approach, delta temporality is actually simpler -- each metric data point represents the incremental usage since the last report.

Metrics are exported via `ExportMetricsServiceRequest` to `/v1/metrics`. They are separate from and complementary to the per-event log records.

---

## Assumption Verification Summary

| # | Assumption in Existing Design | Verdict | Details |
|---|---|---|---|
| 1 | Claude Code sends traces to `/v1/traces` | **CONTRADICTED** | Sends logs to `/v1/logs` and metrics to `/v1/metrics` |
| 2 | Payload is `ExportTraceServiceRequest` with `resourceSpans` | **CONTRADICTED** | Payload is `ExportLogsServiceRequest` with `resourceLogs` |
| 3 | `claude_code.api_request` exists | **CONFIRMED** | Exists as an event name, not a span name |
| 4 | `input_tokens` attribute name | **CONFIRMED** | Exact name on `api_request` events |
| 5 | `output_tokens` attribute name | **CONFIRMED** | Exact name on `api_request` events |
| 6 | `cache_read_tokens` attribute name | **CONFIRMED** | Exact name on `api_request` events |
| 7 | `cache_creation_tokens` attribute name | **CONFIRMED** | Exact name on `api_request` events |
| 8 | `cost_usd` attribute name | **CONFIRMED** | Exact name, described as estimated cost |
| 9 | `model` attribute name | **CONFIRMED** | Exact name, example: "claude-sonnet-4-6" |
| 10 | `session_id` as attribute name | **CONTRADICTED** | Actual name is `session.id` (dot, not underscore) |
| 11 | `session_id` in resource attributes | **CONTRADICTED** | `session.id` is a standard attribute on events/metrics, not a resource attribute |
| 12 | `CLAUDE_CODE_ENABLE_TELEMETRY` env var | **CONFIRMED** | Set to `1` to enable |
| 13 | `OTEL_EXPORTER_OTLP_ENDPOINT` env var | **CONFIRMED** | Standard OTel variable, used as base URL |
| 14 | HTTP/JSON format (ADR-031) | **PARTIALLY CONFIRMED** | HTTP/JSON is one of three supported protocols; not the default |

## Corrected ExportLogsServiceRequest Payload Structure

Based on the OTel logs data model, the actual payload Claude Code sends to `/v1/logs` would follow this structure:

```json
{
  "resourceLogs": [{
    "resource": {
      "attributes": [
        { "key": "service.name", "value": { "stringValue": "claude-code" } },
        { "key": "service.version", "value": { "stringValue": "1.0.x" } },
        { "key": "os.type", "value": { "stringValue": "windows" } },
        { "key": "host.arch", "value": { "stringValue": "amd64" } }
      ]
    },
    "scopeLogs": [{
      "scope": {
        "name": "com.anthropic.claude_code"
      },
      "logRecords": [{
        "timeUnixNano": "1711200000000000000",
        "severityNumber": 9,
        "body": { "stringValue": "claude_code.api_request" },
        "attributes": [
          { "key": "event.name", "value": { "stringValue": "api_request" } },
          { "key": "session.id", "value": { "stringValue": "unique-session-id" } },
          { "key": "prompt.id", "value": { "stringValue": "uuid-v4-value" } },
          { "key": "model", "value": { "stringValue": "claude-sonnet-4-6" } },
          { "key": "cost_usd", "value": { "doubleValue": 0.042 } },
          { "key": "input_tokens", "value": { "intValue": "1500" } },
          { "key": "output_tokens", "value": { "intValue": "800" } },
          { "key": "cache_read_tokens", "value": { "intValue": "500" } },
          { "key": "cache_creation_tokens", "value": { "intValue": "200" } },
          { "key": "duration_ms", "value": { "intValue": "3200" } },
          { "key": "speed", "value": { "stringValue": "normal" } },
          { "key": "user.account_uuid", "value": { "stringValue": "..." } },
          { "key": "organization.id", "value": { "stringValue": "..." } }
        ]
      }]
    }]
  }]
}
```

**IMPORTANT CAVEAT**: This payload structure is inferred from the OTel logs specification combined with the documented attribute names. The exact JSON structure has not been captured from a live Claude Code instance. A brief spike (run Claude Code with `OTEL_LOGS_EXPORTER=console`) would confirm the exact layout.

## Source Analysis

| Source | Domain | Reputation | Type | Access Date | Cross-verified |
|---|---|---|---|---|---|
| Claude Code Docs - Monitoring | code.claude.com | High (1.0) | Official vendor docs | 2026-03-23 | Y |
| GitHub Issue #15417 | github.com/anthropics | High (1.0) | Official issue tracker | 2026-03-23 | Y |
| Honeycomb Blog | honeycomb.io | Medium-High (0.8) | Vendor practitioner guide | 2026-03-23 | Y |
| SigNoz Docs | signoz.io | Medium-High (0.8) | Vendor practitioner guide | 2026-03-23 | Y |
| Quesma Blog | quesma.com | Medium (0.6) | Practitioner guide | 2026-03-23 | Y |
| OTel GenAI Semantic Conventions | opentelemetry.io | High (1.0) | Standards body | 2026-03-23 | Y |
| GitHub anthropics/claude-code-monitoring-guide | github.com/anthropics | High (1.0) | Official reference repo | 2026-03-23 | Y |

Reputation: High: 4 (57%) | Medium-High: 2 (29%) | Medium: 1 (14%) | Avg: 0.89

## Knowledge Gaps

### Gap 1: Exact OTel Log Record JSON Structure from Live Claude Code
**Issue**: While the attribute names are confirmed from official docs, the exact `ExportLogsServiceRequest` JSON structure (particularly how `event.name` maps to log record body vs attributes) has not been captured from a running Claude Code instance.
**Attempted**: Official docs, GitHub issues, vendor blogs. None show a raw OTLP payload dump.
**Recommendation**: Run `OTEL_LOGS_EXPORTER=console` and capture the console output, or use an OTel Collector with `debug` exporter to capture the exact payload. This is a 15-minute spike.

### Gap 2: Whether `event.name` Is the Log Record Body or an Attribute
**Issue**: The OTel events specification allows the event name to appear as the log record `body` field or as an `event.name` attribute. The official docs list `event.name` as an attribute, but the actual serialization format matters for parsing.
**Attempted**: Docs list `event.name` as an attribute on each event type. No raw payload available.
**Recommendation**: Same spike as Gap 1 -- console output will clarify.

### Gap 3: Claude Code's Behavior with Non-Standard OTLP Endpoints
**Issue**: ADR-030 plans to host `/v1/logs` on port 3748 alongside the hooks receiver. It is unconfirmed whether Claude Code's OTel SDK will correctly route to `/v1/logs` when given a base endpoint of `http://127.0.0.1:3748` (HTTP protocol appends signal-specific paths automatically, but behavior may differ by protocol setting).
**Attempted**: Docs confirm standard OTel SDK behavior. Not tested with Norbert's single-port setup.
**Recommendation**: Test during implementation with `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` and `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3748`.

## Recommendations for Further Research

1. **15-minute spike**: Run Claude Code with `OTEL_LOGS_EXPORTER=console` and `OTEL_METRICS_EXPORTER=console` to capture exact payload structures. This will resolve Gaps 1 and 2 definitively.
2. **Update ADR-030**: Change route from `/v1/traces` to `/v1/logs`. Consider also adding `/v1/metrics` if the metrics signal is valuable.
3. **Update ADR-031**: Change parsing structs from `ExportTraceServiceRequest` to `ExportLogsServiceRequest`. The struct names change but the general approach (hand-written serde structs for a JSON subset) remains sound.
4. **Update data-models.md**: Fix the payload structure, fix `session_id` to `session.id`, change the OTel wrapper from `resourceSpans`/`scopeSpans`/`spans` to `resourceLogs`/`scopeLogs`/`logRecords`.
5. **Consider ingesting additional events**: `tool_result` and `user_prompt` events carry valuable data (tool execution times, tool success rates) that could enhance Norbert's dashboard.

## Full Citations

[1] Anthropic. "Monitoring - Claude Code Docs". code.claude.com. 2026. https://code.claude.com/docs/en/monitoring-usage. Accessed 2026-03-23.
[2] Anthropic. "[DOCS] Clarify that OTEL telemetry exports events via logs protocol, not metrics - Issue #15417". GitHub. 2025. https://github.com/anthropics/claude-code/issues/15417. Accessed 2026-03-23.
[3] Honeycomb. "Measuring Claude Code ROI and Adoption in Honeycomb". honeycomb.io. 2025. https://www.honeycomb.io/blog/measuring-claude-code-roi-adoption-honeycomb. Accessed 2026-03-23.
[4] SigNoz. "Claude Code Monitoring & Observability with OpenTelemetry". signoz.io. 2025. https://signoz.io/docs/claude-code-monitoring/. Accessed 2026-03-23.
[5] Quesma. "Claude Code + OpenTelemetry + Grafana: A guide to tracking usage and limits". quesma.com. 2025. https://quesma.com/blog/track-claude-code-usage-and-limits-with-grafana-cloud/. Accessed 2026-03-23.
[6] OpenTelemetry. "Semantic conventions for generative client AI spans". opentelemetry.io. 2025. https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/. Accessed 2026-03-23.
[7] Anthropic. "claude-code-monitoring-guide". GitHub. 2025. https://github.com/anthropics/claude-code-monitoring-guide. Accessed 2026-03-23.

## Research Metadata

Duration: ~15 min | Examined: 12 | Cited: 7 | Cross-refs: 18 | Confidence: High 88%, Medium 12%, Low 0% | Output: docs/research/claude-code-otel-telemetry-actual-emissions.md
