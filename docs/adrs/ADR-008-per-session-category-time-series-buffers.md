# ADR-008: Per-Session Per-Category Time-Series Buffers

## Status
Accepted

## Context
The v1 MultiSessionStore tracks `SessionMetrics` per session but does NOT maintain per-session time-series buffers. The v1 time-series buffer lives in MetricsStore and is aggregate-only (broadcast session). The v2 design requires per-session mini-graphs for each category (tokens/s, cost, agents, context), which means each session needs its own independent ring buffer for each metric category.

Additionally, the v2 design introduces 4 metric categories with different value types (rate, currency, count, percentage). Each needs its own buffer rather than sharing a single RateSample buffer.

## Decision
Extend MultiSessionStore to maintain:
1. **Per-session, per-category buffers**: `Map<sessionId, Map<MetricCategoryId, TimeSeriesBuffer>>` -- one ring buffer per session per category
2. **Aggregate-category buffers**: `Map<MetricCategoryId, TimeSeriesBuffer>` -- aggregate buffer per category, recomputed on each sample for applicable categories (tokens, cost, agents)
3. **Subscribe/notify**: Subscriber callback invoked on buffer updates so views can re-render

The hookProcessor is extended to compute per-category sample values after each event and call `appendSessionSample` on the store.

## Alternatives Considered

### Alternative 1: Compute per-session buffers from raw events on demand
- On each render, query SQLite for recent events per session, fold into time-series
- **Rejected**: Too expensive at 10Hz render rate. SQLite queries on every frame would cause jank. Ring buffers are O(1) append/read.

### Alternative 2: Single combined RateSample buffer per session (extend existing type)
- Add `agentCount` and `contextPct` fields to RateSample
- **Rejected**: RateSample is used throughout the codebase (oscilloscope, burn rate, stats). Adding fields to it would couple unrelated concerns. Category-specific buffers have cleaner boundaries.

### Alternative 3: Store category buffers in domain layer (pure)
- Maintain buffers as immutable values threaded through the hook pipeline
- **Rejected**: Per-session * per-category * per-window = potentially 60+ buffers at 5 sessions. Immutable updates for ring buffers at 1Hz across all of these would create excessive garbage collection pressure. Mutable adapter is appropriate here -- it is the effect boundary.

## Consequences
- **Positive**: Per-session graphs have dedicated data without recomputation
- **Positive**: Aggregate buffers precomputed, not recomputed per render frame
- **Positive**: Category isolation -- context buffer independent of token rate buffer
- **Negative**: Memory usage increases: ~4 categories * ~5 sessions * 600 samples * 8 bytes = ~96KB (negligible)
- **Negative**: MultiSessionStore becomes more complex (additional state maps + notify mechanism)
