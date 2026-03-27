# ADR-044: OTel-Active Flag Propagation via Explicit Parameter

## Status

Proposed

## Context

The metrics aggregator needs to know whether a session is OTel-active to select the correct dispatch table (suppress hook token/cost when OTel provides authoritative data). Three approaches were considered for propagating this flag.

The aggregator is a pure fold function: `(prev, event, pricingTable) => next`. Adding OTel awareness must preserve purity and testability.

## Decision

Add `isOtelActive: boolean` as an explicit parameter to `aggregateEvent`. The caller (hookProcessor) is responsible for computing/providing the flag. The aggregator remains a pure function with no ambient state.

Signature becomes: `(prev, event, pricingTable, isOtelActive) => next`.

## Alternatives Considered

### A: Context object wrapping the event
- Wrap event + metadata in a context object: `{ event, isOtelActive, ... }`
- **Rejected**: Over-engineering for a single boolean. Adds a new type for one field. If more context fields are needed later, refactoring from parameter to context is straightforward.

### B: Dispatch table selected externally (caller picks table)
- hookProcessor selects the correct dispatch table and passes it to a generic `applyHandler(table, prev, event)` function
- **Rejected**: Leaks aggregator internals (dispatch tables) to the caller. The caller should not know about the aggregator's internal dispatch mechanism. The flag is a domain concept; the table selection is an implementation detail.

### C: Derive isOtelActive from SessionMetrics (check if apiRequestCount > 0)
- No parameter needed; aggregator checks `prev.apiRequestCount > 0`
- **Rejected**: Circular dependency -- the first `api_request` event would not trigger OTel mode because `apiRequestCount` is still 0 when it arrives. Requires special-casing the first event. Also, the aggregator should not derive session-level state from its own accumulated metrics.

## Consequences

- **Positive**: Pure function preserved. Fully testable -- pass `true` or `false` to test both paths.
- **Positive**: No ambient state, no module-level flags, no React context dependency in domain layer.
- **Negative**: Breaking change to `aggregateEvent` signature. All callers (hookProcessor, multi-session store updater) must be updated. Acceptable: there are exactly 2 call sites.
