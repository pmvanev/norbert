# ADR-045: Dual Dispatch Table for OTel-Aware Event Handling

## Status

Proposed

## Context

When OTel is active, certain hook events must be suppressed (no token/cost contribution) while OTel events are enriched (tool_result feeds tool stats, api_error tracks errors). The aggregator currently uses a single dispatch table mapping event types to handlers.

The challenge: the same event type (e.g., `prompt_submit`) needs different behavior depending on whether OTel is active. Five event types are affected: `prompt_submit`, `tool_call_end`, `agent_complete`, `tool_call_start`, `tool_result`.

## Decision

Maintain two static dispatch tables: `hookEventHandlers` (current behavior, unchanged) and `otelEventHandlers` (OTel-aware behavior). The `aggregateEvent` function selects the table based on the `isOtelActive` parameter.

OTel table differences from hook table:
- `prompt_submit`: identity (no token/cost)
- `tool_call_end`: identity (no token/cost)
- `agent_complete`: agent count only (no token/cost)
- `tool_call_start`: identity (superseded by tool_result)
- `tool_result`: increment toolCallCount + feed tool usage
- `api_error`: increment apiErrorCount
- `api_request`: same as hook table (already uses cost_usd per ADR-033) + increment apiRequestCount

## Alternatives Considered

### A: Conditional logic per handler
- Each handler checks `isOtelActive` and branches
- **Rejected**: Scatters the OTel concern across 5+ functions. Violates single-responsibility for individual handlers. Adding a third source requires touching every handler.

### B: Handler composition with wrappers
- Wrap handlers with `withOtelSuppress(handler)` that returns identity when OTel active
- **Rejected**: Clever but obscure. The dispatch table approach is more explicit and readable. When debugging, you can look at one table and see all OTel behavior. With wrappers, you must trace through composition layers.

### C: Single table with handler factories
- `createHandler(hookFn, otelFn)` returns a function that selects based on flag
- **Rejected**: Functionally equivalent to dual tables but adds a factory abstraction layer without clarity benefit. Two flat tables are simpler to read and modify.

## Consequences

- **Positive**: OTel behavior is visible in one place (the otelEventHandlers table). Easy to audit.
- **Positive**: Hook table is literally unchanged -- zero regression risk for hook-only sessions.
- **Positive**: Individual handlers stay pure and focused on one concern.
- **Negative**: Some duplication between tables (shared entries like `api_request`, `session_start`). Acceptable: duplication is 3-4 lines and avoids abstraction complexity.
