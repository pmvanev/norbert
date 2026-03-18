# ADR-026: Multi-Session Aggregation via Additive Store

## Status

Accepted

## Context

The Performance Monitor requires cross-session aggregate metrics (total tokens/s, total cost/min, total active agents) across all active Claude Code sessions. The existing norbert-usage architecture tracks metrics for a single session at a time via the broadcast context mechanism (MetricsStore holds one SessionMetrics).

**Quality attribute drivers**: Performance (aggregation must not block 10Hz rendering), maintainability (pure functional core), backward compatibility (existing views must continue working unchanged).

**Constraints**: Solo developer. Existing MetricsStore interface is consumed by 4 views (Gauge Cluster, Oscilloscope, Dashboard, Cost Ticker). Changing its interface risks breaking all existing views.

## Decision

Additive Multi-Session Store alongside the existing MetricsStore.

**Mechanism**:
1. New `multiSessionStore.ts` adapter holds `Map<sessionId, SessionMetrics>` and per-session/aggregate time-series buffers
2. Hook processor extracts `session_id` from event payload and routes to both:
   - Existing MetricsStore (for broadcast session -- backward compatibility)
   - Multi-Session Store (for the event's specific session)
3. Session Discovery Adapter polls `sessions` table every 2 seconds to detect new/ended sessions
4. Cross-Session Aggregator (pure function) computes `AggregateMetrics` from all active SessionMetrics on each update
5. PM views subscribe to Multi-Session Store; existing views continue subscribing to existing MetricsStore

**Data flow**:
```
Hook event (session_id: "abc")
  -> Hook Processor
     -> MetricsStore.update (if "abc" is broadcast session) [existing path]
     -> MultiSessionStore.updateSession("abc", ...) [new path]
        -> crossSessionAggregator(allSessions) -> AggregateMetrics
        -> notify PM subscribers
```

## Alternatives Considered

### Alternative 1: Refactor MetricsStore to be multi-session
- What: Modify MetricsStore to hold Map<sessionId, SessionMetrics> instead of single SessionMetrics. Update all existing views to accept sessionId parameter.
- Tradeoff: Unified store. But requires modifying all 4 existing view components and their subscription patterns. High regression risk.
- Why rejected: Violates backward compatibility. Existing views work correctly with single-session semantics. Introducing sessionId parameter to Gauge Cluster, Oscilloscope, Dashboard, and Cost Ticker is unnecessary churn with zero user benefit for those views.

### Alternative 2: One MetricsStore instance per session
- What: Create a new MetricsStore for each active session. PM aggregates by reading all instances.
- Tradeoff: Reuses existing MetricsStore interface. But managing a dynamic set of store instances, wiring subscriptions, and garbage collecting ended sessions adds complexity. Each store has its own subscriber list, making cross-session notification inconsistent.
- Why rejected: Store lifecycle management complexity. Cross-session aggregation requires reading from N stores and computing sums -- this is what a dedicated aggregation store does more cleanly.

### Alternative 3: Query SQLite directly for aggregate metrics
- What: PM view runs SQL queries against events table to compute aggregate metrics across sessions.
- Tradeoff: Zero in-memory state for aggregation. But SQL cannot compute instantaneous rates, context window %, or time-series waveforms. Would require complex JSON extraction in SQL for token/cost data.
- Why rejected: Same reasoning as ADR-017 (client-side aggregation). Pricing computation in SQL is fragile. Rate computation requires application-level time-windowing. 10Hz chart updates cannot query SQLite per frame.

## Consequences

- Positive: Existing views unchanged. Zero regression risk for Gauge Cluster, Oscilloscope, Dashboard, Cost Ticker.
- Positive: Clean separation: Multi-Session Store owns cross-session concerns; MetricsStore owns broadcast-session concerns.
- Positive: Cross-session aggregation is a pure function, independently testable. Property: aggregate.totalTokenRate === sum of per-session burnRates.
- Negative: Two stores exist for partially overlapping data (broadcast session exists in both). Accepted: data consistency maintained because both are fed from the same hook event pipeline. The duplication is of references, not of computation.
- Negative: Session discovery polling adds one SQL query every 2 seconds. Accepted: lightweight query (SELECT with WHERE on NULL column), negligible load.
