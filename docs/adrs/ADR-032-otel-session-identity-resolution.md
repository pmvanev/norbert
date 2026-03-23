# ADR-032: OTel Session Identity Resolution

## Status

Accepted (updated 2026-03-23: corrected attribute name from `session_id` to `session.id` and location from span/resource to log record standard attributes, per research findings)

## Context

Hook events carry `session_id` (underscore) as a top-level field in the JSON payload. OTel log records carry the session identifier as `session.id` (dot-separated) in their attributes array. For a single Claude Code session, both hooks and OTel data must map to the same session_id so the frontend displays unified metrics.

**Research confirmation (2026-03-23)**: The attribute name is `session.id` (dot, not underscore) and it is a **standard attribute on all Claude Code log records** (not a resource attribute). See `docs/research/claude-code-otel-telemetry-actual-emissions.md`.

## Decision

Extract `session.id` from OTel log record attributes only (not resource attributes). Map the value to the internal `session_id` used by the EventStore. If `session.id` is absent, drop the log record and log a warning.

No fallback to resource attributes -- research confirmed `session.id` is always present on log records as a standard attribute.

## Alternatives Considered

### A: Search both log record attributes and resource attributes
- Check log record attributes first, then resource attributes
- **Rejected**: Research confirmed `session.id` is always a standard attribute on log records. Searching resource attributes adds unnecessary complexity and could match a wrong value if resource attributes change.

### B: Generate session_id from other attributes
- Derive from `organization.id` + `user.id` or similar
- **Rejected**: `session.id` is the exact value that matches the hook event `session_id`. Deriving from other attributes risks creating mismatched session identifiers.

### C: Single-location lookup from log record attributes (selected)
- Extract `session.id` (dot-separated) from log record attributes only
- Use the value directly as the internal `session_id`
- Drop log record if `session.id` not found

## Consequences

- **Positive**: Simple, single-location extraction. Research confirmed the exact attribute name and location.
- **Positive**: `session.id` in OTel log records matches the `session_id` value from hook events for the same Claude Code session, enabling unified session view.
- **Positive**: Warning log when `session.id` is missing enables debugging without silent data loss.
- **Negative**: If Claude Code changes the attribute name, all log records will be dropped. Mitigated: the warning log makes this immediately discoverable. The attribute name is a documented standard.
