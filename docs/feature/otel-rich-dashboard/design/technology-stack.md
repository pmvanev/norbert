# Technology Stack: OTel Rich Dashboard

**Feature ID**: otel-rich-dashboard
**Date**: 2026-03-24

---

## Existing Stack (No New Dependencies)

This feature requires **zero new dependencies**. All technology is already in the project.

### Backend (Rust)

| Technology | Version | License | Role in This Feature |
|-----------|---------|---------|---------------------|
| Rust | 1.x (stable) | MIT/Apache-2.0 | All backend logic |
| axum | existing | MIT | New `/v1/metrics` route handler |
| serde_json | existing | MIT/Apache-2.0 | OTLP metrics JSON parsing |
| rusqlite | existing | MIT | Metrics table and session_metadata table |
| chrono | existing | MIT/Apache-2.0 | Timestamp handling for last_updated_at |
| tokio | existing | MIT | Async runtime (existing) |

### Frontend (TypeScript/React)

| Technology | Version | License | Role in This Feature |
|-----------|---------|---------|---------------------|
| React | existing | MIT | Dashboard card components |
| TypeScript | existing | Apache-2.0 | Type-safe domain modules |
| Tauri IPC | existing | MIT/Apache-2.0 | New IPC commands for metrics/metadata |

### Storage

| Technology | Version | License | Role in This Feature |
|-----------|---------|---------|---------------------|
| SQLite | existing (bundled) | Public Domain | New `metrics` and `session_metadata` tables |

---

## Rationale

No new dependencies needed because:
- OTLP metrics JSON uses the same structure as logs (serde_json handles both)
- SQLite upsert (`INSERT ... ON CONFLICT DO UPDATE`) requires no extensions
- Frontend aggregation logic is pure TypeScript -- no charting/visualization libraries needed for summary cards
- The plugin architecture (registerView) already supports adding views

---

## Alternatives Considered

### DuckDB for Analytics
- What: Use DuckDB for metric aggregation queries
- Why rejected: Overkill for single-user local app. SQLite upsert handles accumulation. Adds 20MB+ binary dependency.

### Redis for Delta Accumulation
- What: In-memory accumulation with periodic SQLite flush
- Why rejected: Adds process management complexity. SQLite WAL mode already provides adequate write performance for 60s metric intervals. Violates single-binary philosophy (ADR-005).

### Recharts/D3 for Card Visualization
- What: Use charting library for dashboard cards
- Why rejected: Cards show summary numbers and simple breakdowns, not time-series charts. Plain HTML/CSS sufficient. The existing PM already uses canvas for charts; new cards are metric displays, not graphs.
