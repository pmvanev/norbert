# ADR-036: Delta Accumulation Location

## Status
Accepted

## Context
All 8 Claude Code metrics use delta temporality: each data point represents the change since the last export. To display totals (e.g., total cost, total lines of code), deltas must be accumulated. The accumulation can happen in the backend (on write) or frontend (on read).

## Decision
Backend accumulation via SQLite upsert. The `metrics` table stores running totals. On each metric ingestion, the handler performs `INSERT ... ON CONFLICT DO UPDATE SET value = value + delta`. Frontend reads totals directly without computation.

## Alternatives Considered

### Alternative 1: Frontend Accumulation
- **What**: Backend stores raw delta data points. Frontend sums all deltas for a session on each render.
- **Expected Impact**: 100% functionally but with performance cost
- **Why Rejected**: Metric exports every 60s means ~60 data points per metric per hour. Frontend would scan and sum on each render. State lost on page refresh (user navigates away, returns, sees zeros until next delta arrives). Requires frontend state management for accumulation that duplicates database capability.

### Alternative 2: Dual Storage (Raw + Accumulated)
- **What**: Store both raw delta data points and accumulated totals
- **Expected Impact**: 100% with full historical data
- **Why Rejected**: Over-engineered for current needs. No user story requires viewing individual delta values or historical metric rates. The session-level total is the only needed view. Raw deltas can be added later if time-series metric visualization is needed.

## Consequences
- **Positive**: Frontend reads are O(1) per metric. Page refresh shows correct totals. No frontend state management needed for accumulation.
- **Positive**: SQLite upsert is atomic -- no race conditions with concurrent metric exports.
- **Negative**: Cannot reconstruct individual delta history (only totals stored). Acceptable because no user story requires delta history.
