# ADR-017: Client-Side Metric Aggregation Over Server-Side Materialized Views

## Status

Accepted

## Context

norbert-usage needs to compute metrics (session cost, token totals, burn rate, active agents) from raw events. Two approaches: (1) compute metrics in TypeScript from raw event data, or (2) create SQLite materialized views or summary tables updated by triggers.

**Quality attribute drivers**: Maintainability (single source of truth), simplicity (solo developer), correctness (metrics always consistent with events), time-to-market.

**Constraints**: Plugin runs in browser context. Plugin's SQLite access is via `api.db.execute()` (sandboxed). Adding SQLite triggers requires Rust changes to the event store. Solo developer.

## Decision

Client-side aggregation. All metric computation happens in TypeScript pure functions within the norbert-usage plugin. No new SQLite tables, views, or triggers.

**Flow**:
1. Plugin loads historical events for a session via SQL query
2. Events are folded through the Metrics Aggregator (pure function) to produce SessionMetrics
3. New events arriving via hook processor are incrementally folded into the running metrics
4. Views read the computed SessionMetrics from the Metrics State Store

## Alternatives Considered

### Alternative 1: SQLite summary table updated by Rust triggers
- What: Add a `session_metrics` table with columns for cost, tokens, etc. SQLite triggers update it on INSERT into events.
- Tradeoff: Metrics always pre-computed; reads are fast. But requires Rust-side schema changes, trigger logic, and migration for every metric change.
- Why rejected: Crosses the plugin boundary into core Norbert. Plugin should not require Rust changes. Trigger logic duplicates pricing computation in a second language.

### Alternative 2: SQLite window functions computed on read
- What: Use SQL window functions (SUM, COUNT, etc.) to compute metrics from events table on each query
- Tradeoff: No new tables needed. But cannot compute derived metrics like burn rate or context window %. Complex SQL for every metric query. Cache token costing requires JSON extraction in SQL.
- Why rejected: Pricing computation in SQL is fragile (JSON path extraction + model matching). Burn rate requires time-windowed computation better suited to application code. Complex SQL is harder to test than pure TypeScript functions.

## Consequences

- Positive: All computation in TypeScript, testable with unit tests, follows FP paradigm.
- Positive: Zero schema changes to core Norbert. Plugin is fully self-contained.
- Positive: Incremental folding means only new events need processing after initial load.
- Negative: Initial session load requires reading all events and folding. For a session with 10,000 events, this is a one-time O(N) scan. Acceptable: 10K events fold in <100ms in modern JS.
- Negative: If the app restarts, metrics must be recomputed from events. Acceptable: the events table is the source of truth; recomputation is deterministic and fast.
