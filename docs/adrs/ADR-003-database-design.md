# ADR-003: Database Design -- SQLite WAL with Minimal Schema

## Status

Accepted

## Context

The walking skeleton needs to store hook events from Claude Code sessions and retrieve session summaries for UI display. The database must handle concurrent read/write (HTTP server writes while UI reads), survive app restarts, and be extensible for future plugin data.

**Constraints**: Local-first (no network DB). Single file at `~/.norbert/norbert.db`. Must handle 100+ events/second bursts.

## Decision

Two tables (`sessions`, `events`) with SQLite WAL mode and NORMAL synchronous. Events store the full JSON payload as TEXT, deferring structured extraction to future phases.

**Schema**: See architecture.md data model section.

**Key design choices**:
- Full payload stored as JSON TEXT: enables future queries without migration. Plugins can extract fields as needed.
- Session ID from Claude Code (not auto-generated): enables direct correlation with Claude Code's own session tracking.
- `received_at` timestamp: Norbert's clock, not Claude Code's. Avoids clock drift issues.
- Event count denormalized on sessions table: avoids COUNT(*) query on every UI refresh.

## Alternatives Considered

### Normalized event schema (columns per field instead of JSON blob)

- Evaluated against: schema stability, migration burden, walking skeleton scope
- Rejection: Claude Code hook payload structure may evolve. Extracting specific columns now creates migration debt when payloads change. The walking skeleton only needs event type and timestamp -- payload column preserves all data for future extraction without schema changes. Phase 2+ can add computed columns or views as needed.

### Separate database per session

- Evaluated against: query simplicity, file management, backup complexity
- Rejection: Cross-session queries (total event count, session list) become file system scans. Single database with session_id foreign key is simpler for both walking skeleton and future phases.

### In-memory event buffer with periodic flush

- Evaluated against: reliability requirement (no silent data loss)
- Rejection: App crash loses buffered events. The reliability requirement demands persistence before HTTP 200 response. WAL mode makes individual writes fast enough (sub-millisecond) that buffering adds risk without meaningful performance gain.

## Consequences

**Positive**:
- WAL mode: readers never block writers, writers never block readers
- NORMAL synchronous: acceptable durability/performance tradeoff for desktop app (data loss only on OS crash, not app crash)
- JSON payload: future-proof against hook schema changes
- Denormalized event_count: O(1) session summary queries

**Negative**:
- JSON payload not directly queryable without json_extract() (acceptable: walking skeleton only needs count and type)
- Denormalized count must be maintained on every insert (simple UPDATE +1)
- WAL mode creates two additional files (.wal, .shm) in the data directory
