# ADR-035: Metrics Storage Strategy

## Status
Proposed

## Context
Claude Code sends `POST /v1/metrics` with `ExportMetricsServiceRequest` containing 8 metric types. All use delta temporality (each data point is an increment, not a total). Data points have compound identity: session_id + metric_name + discriminating attributes (model, type, etc.).

We need to decide how to store metric data points and where to accumulate delta values into totals.

Options: (A) store in existing events table as synthetic events, (B) dedicated metrics table with pre-accumulated totals, (C) in-memory accumulation with no persistence.

## Decision
Dedicated `metrics` table with compound primary key `(session_id, metric_name, attribute_key)` and atomic upsert accumulation. Backend accumulates deltas on write using `INSERT ... ON CONFLICT DO UPDATE SET value = value + excluded.value`.

## Alternatives Considered

### Alternative 1: Synthetic Events in Existing Events Table
- **What**: Store each metric data point as an event (event_type = "metric_cost_usage", payload = JSON with value)
- **Expected Impact**: 90% -- no schema change, reuses existing infrastructure
- **Why Rejected**: Metric exports arrive every 60s; a 1-hour session with 8 metrics produces ~480 synthetic events. Frontend would need to scan and sum all synthetic events on every render to compute totals. For sessions with 500+ real events, this adds 480+ more rows to scan. Also, metric data points lack prompt.id, event.sequence, and other event-specific attributes, making them a poor fit for the events table shape.

### Alternative 2: In-Memory Accumulation Only
- **What**: Accumulate in a Rust HashMap, serve via IPC, no persistence
- **Expected Impact**: 80% -- works while app is running
- **Why Rejected**: Totals lost on app restart or page refresh. User closes Norbert, reopens, metric cards show zero. Defeats the "review past sessions" use case.

## Consequences
- **Positive**: Single IPC call returns pre-accumulated totals. O(1) read per metric. Survives app restarts. SQLite upsert is atomic and handles concurrent writes.
- **Positive**: Compound key naturally handles multi-attribute metrics (token.usage has 4 type variants per model).
- **Negative**: New table requires schema migration. Two storage paths (events + metrics) instead of one.
- **Mitigated**: Schema creation is additive (`CREATE TABLE IF NOT EXISTS`). No existing data affected.
