# ADR-032: OTel Session Identity Resolution

## Status

Accepted

## Context

Hook events carry `session_id` as a top-level field in the JSON payload. OTel spans carry attributes in a different structure (`attributes` array with key-value objects). For a single Claude Code session, both hooks and OTel data must map to the same session_id so the frontend displays unified metrics.

The exact location of session_id in Claude Code OTel spans requires investigation. It may appear as a span attribute, a resource attribute, or potentially both.

## Decision

Extract session_id from OTel data using a priority-ordered search:
1. Span attributes: look for `session_id` key
2. Resource attributes: look for `session_id` key
3. If not found in either location: drop the span and log a warning

This approach handles the uncertainty about where Claude Code places the session identifier without requiring a spike before implementation. The crafter should verify the actual attribute location during development and adjust the search order if needed.

## Alternatives Considered

### A: Require spike before implementation
- Run Claude Code with OTel enabled, capture raw spans, document exact attribute locations
- **Rejected**: Delays implementation. The two-location fallback strategy handles all known possibilities. The parser can be refined during development when real data is available.

### B: Generate session_id from OTel trace_id
- Use the OTel trace_id as a session identifier
- **Rejected**: trace_id is per-trace (potentially per-request), not per-session. Would create many small sessions instead of one session per Claude Code session.

### C: Priority-ordered attribute search (selected)
- Check span attributes first, then resource attributes
- Log what was found for observability
- Drop span if no session_id found anywhere

## Consequences

- **Positive**: Handles both possible locations without prior knowledge of the exact placement.
- **Positive**: Warning log when session_id is missing enables debugging without silent data loss.
- **Negative**: If Claude Code uses a non-standard attribute name (not `session_id`), spans will be dropped. Mitigated: the warning log makes this quickly discoverable.
- **Negative**: If session_id format differs between hooks and OTel (e.g., prefix differences), events may split across two sessions. Mitigated: this is detectable during development and a normalization function can be added.
