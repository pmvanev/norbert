# Shared Artifacts Registry: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24

---

## Registry

### session_id
- **Source of truth**: `session.id` standard attribute on OTLP log records and metric data points
- **Consumers**: metrics storage, session routing, session list, all dashboard cards, event correlation
- **Owner**: Hook receiver (OTLP handler)
- **Integration risk**: HIGH -- session.id uses dot notation (not underscore); must match predecessor's extraction logic
- **Validation**: Every persisted metric and event has a non-empty session_id matching an existing session

### terminal_type
- **Source of truth**: `terminal.type` standard attribute on OTLP log records
- **Consumers**: session list IDE badge
- **Owner**: Session enrichment logic
- **Integration risk**: MEDIUM -- attribute may be absent; known values: "vscode", "cursor", "iTerm.app", "tmux"
- **Validation**: Badge renders for known values; missing attribute produces no badge (not an error)

### service_version
- **Source of truth**: `service.version` resource attribute on OTLP payload
- **Consumers**: session list version text, session detail header
- **Owner**: Session enrichment logic
- **Integration risk**: LOW -- resource attribute is consistently present in observed payloads
- **Validation**: Version string displayed as-is (e.g., "2.1.81")

### platform_info
- **Source of truth**: `os.type` + `host.arch` resource attributes on OTLP payload
- **Consumers**: session list platform text, session detail header
- **Owner**: Session enrichment logic
- **Integration risk**: LOW -- resource attributes consistently present
- **Validation**: Displayed as "{os.type} {host.arch}" (e.g., "Windows amd64")

### model_name
- **Source of truth**: `model` attribute on api_request events (canonical form without context window suffix)
- **Consumers**: Cost & Tokens card, cost aggregation, model breakdown displays
- **Owner**: OTLP handler (normalization)
- **Integration risk**: HIGH -- metrics use "claude-opus-4-6[1m]" while events use "claude-opus-4-6"; must normalize before storage or aggregation
- **Validation**: Strip `[...]` suffix from metric model names; verify events and metrics aggregate to same model key

### cost_total
- **Source of truth**: Primary: `cost_usd` from api_request events; Supplementary: `claude_code.cost.usage` metric
- **Consumers**: session list cost column, Cost & Tokens card
- **Owner**: Frontend metrics aggregator
- **Integration risk**: HIGH -- two data sources for the same value; must not double-count
- **Validation**: Event-sourced cost is primary; metric cost supplements when events are missing or for cross-validation

### active_time_user / active_time_cli
- **Source of truth**: `claude_code.active_time.total` metric with type="user" / type="cli"
- **Consumers**: Active Time card, Productivity detail view
- **Owner**: Metrics storage (delta accumulation)
- **Integration risk**: MEDIUM -- delta temporality requires correct accumulation; reset on new session
- **Validation**: Accumulated values increase monotonically within a session; user + cli = total displayed

### tool_success_rate
- **Source of truth**: Computed from tool_result events (count where success=true / total count)
- **Consumers**: Tool Usage card summary
- **Owner**: Frontend (computed at render time)
- **Integration risk**: LOW -- pure computation from persisted events
- **Validation**: Rate is 0-100%; handle division by zero (0 tool calls = no rate displayed)

### api_error_rate
- **Source of truth**: Computed from api_error event count / api_request event count
- **Consumers**: API Health card summary
- **Owner**: Frontend (computed at render time)
- **Integration risk**: MEDIUM -- requires both event types counted correctly; api_error without corresponding api_request would skew rate
- **Validation**: Rate is 0-100%; zero api_request events means no rate displayed

### lines_added / lines_removed
- **Source of truth**: `claude_code.lines_of_code.count` metric with type="added" / type="removed"
- **Consumers**: Productivity card
- **Owner**: Metrics storage (delta accumulation)
- **Integration risk**: MEDIUM -- delta temporality accumulation
- **Validation**: Non-negative values; net change = added - removed

### commit_count / pr_count
- **Source of truth**: `claude_code.commit.count` / `claude_code.pull_request.count` metrics
- **Consumers**: Productivity card, Git Activity card
- **Owner**: Metrics storage (delta accumulation)
- **Integration risk**: LOW -- simple counter accumulation
- **Validation**: Non-negative integer values

### prompt_id
- **Source of truth**: `prompt.id` standard attribute on OTLP log records (events only, not metrics)
- **Consumers**: Cross-event correlation (linking prompt -> API calls -> tool results)
- **Owner**: Event storage
- **Integration risk**: MEDIUM -- not all events have prompt.id; correlation is best-effort
- **Validation**: UUID format; events with same prompt.id belong to same user prompt turn

### event_sequence
- **Source of truth**: `event.sequence` standard attribute on OTLP log records
- **Consumers**: Event ordering within session timeline
- **Owner**: Event storage
- **Integration risk**: LOW -- monotonic integer, always present
- **Validation**: Strictly increasing within a session; used for chronological ordering

---

## Integration Checkpoints

### Checkpoint 1: Metrics-to-Session Routing
- Metric data points contain session.id in their attributes
- Session must already exist (created by log event) or be created on first metric arrival
- session.id format is UUID, matching the format from log events

### Checkpoint 2: Model Name Normalization
- Events use: "claude-opus-4-6" (no suffix)
- Metrics use: "claude-opus-4-6[1m]" (with context window suffix)
- Normalization must happen before aggregation (strip `[...]` suffix)
- Frontend must not display the raw metric model name

### Checkpoint 3: Cost Data Consistency
- api_request events provide per-request cost_usd
- cost.usage metric provides per-model cost deltas
- Both should converge to similar totals (metric may be slightly delayed)
- Frontend should use event-sourced cost as primary, not sum both

### Checkpoint 4: Empty State Handling
- Sessions with log events but no metric data: metric-dependent cards show "No data"
- Sessions with metric data but missing event types: event cards show "0" (not error)
- New sessions with no events yet: all cards show empty/loading state

### Checkpoint 5: Attribute Availability
- terminal.type: present on most but not all environments
- service.version, os.type, host.arch: present on all observed OTLP payloads (resource-level)
- user.email: present only when authenticated via OAuth
- prompt.id: present on events, not on metrics
