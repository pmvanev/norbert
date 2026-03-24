# ADR-038: Model Name Normalization

## Status
Proposed

## Context
Claude Code reports model names differently in logs vs metrics:
- Log events: `claude-opus-4-6` (no suffix)
- Metric data points: `claude-opus-4-6[1m]` (with context window suffix)

If not normalized, cost and token aggregation by model would show the same model as two entries. Normalization must happen somewhere in the pipeline.

## Decision
Normalize at metric ingestion time in the backend OTLP metrics parser. Strip trailing `[...]` suffix from model attribute values before storage. Pure function applied during parsing, before the data reaches the MetricStore.

## Alternatives Considered

### Alternative 1: Frontend Normalization
- **What**: Store raw model names, strip suffix when rendering
- **Expected Impact**: 100% functionally for display
- **Why Rejected**: Every frontend consumer that aggregates by model would need to apply normalization independently. Aggregation queries in SQLite cannot use the normalized value for grouping. Multiple points of failure vs single point of normalization.

### Alternative 2: Normalization in Both Backend and Frontend
- **What**: Normalize on write AND on read for defense-in-depth
- **Expected Impact**: 100% with redundancy
- **Why Rejected**: Double normalization is unnecessary complexity. If backend normalizes correctly, frontend receives clean data. If backend fails, adding frontend normalization masks the bug rather than surfacing it.

## Consequences
- **Positive**: Single normalization point. All downstream consumers (frontend cards, SQL queries) see consistent model names.
- **Positive**: Metric-sourced cost and event-sourced cost aggregate under the same model key.
- **Negative**: Original model name with context window info is discarded. Acceptable because context window size is not displayed anywhere in the UI and can be inferred from the model name.
