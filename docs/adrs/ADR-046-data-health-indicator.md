# ADR-046: Source-Agnostic Data Health Indicator

## Status

Proposed

## Context

The current `WarningClusterData.hookHealth` only checks `hookEventCount`. When OTel is the primary data source, `hookEventCount` may be low or zero even though data flows correctly. This creates a misleading "degraded" indicator for OTel-active sessions.

The health indicator must work regardless of data source: hooks, OTel, or both.

## Decision

Replace `hookHealth: "normal" | "degraded" | "error"` with `dataHealth: "healthy" | "degraded" | "no-data"`. The new indicator considers:
- **Total event count** (all sources combined) -- renamed from `hookEventCount` to `totalEventCount`
- **Event recency** -- time since `lastEventAt` vs configurable staleness threshold (default 60s)

State logic:
- `totalEventCount === 0` -> `"no-data"`
- `totalEventCount > 0 AND age > threshold` -> `"degraded"`
- `totalEventCount > 0 AND age <= threshold` -> `"healthy"`

`buildWarningCluster` becomes a pure function of `(totalEventCount, lastEventAt, now, threshold)` -- `now` is passed as parameter for deterministic testing.

## Alternatives Considered

### A: Keep hookHealth, add separate otelHealth
- Two indicators: one per source
- **Rejected**: Adds UI complexity. Users do not care which source is healthy -- they care if data is flowing. Two indicators for one concept (pipeline health) is confusing.

### B: Tri-state with source label ("healthy (OTel)" vs "healthy (hooks)")
- Single indicator but with source annotation
- **Rejected for the domain type**: The source label is a UI concern, not a domain concern. The `dataHealth` type should be simple. Source labeling can be added in the view layer if needed, using the already-available `isOtelActive` flag.

## Consequences

- **Positive**: Source-agnostic -- works for hooks, OTel, or mixed sessions without special-casing.
- **Positive**: Recency-based degradation catches stale pipelines regardless of event count.
- **Positive**: Pure function with `now` parameter -- fully deterministic testing.
- **Negative**: Breaking type change on `WarningClusterData` and `SessionMetrics`. All consumers (6 files) must be updated. Acceptable: type system catches all breakage at compile time.
- **Negative**: Rename `hookEventCount` to `totalEventCount` across codebase. Acceptable: only 6 files reference the field.
