# ADR-006: SQLite with better-sqlite3, No ORM

## Status
Accepted

## Context
Norbert stores hook events, session aggregates, agent spans, and MCP health data locally. The database must be zero-config (no external process), cross-platform, and support concurrent reads (CLI + dashboard). The schema has 4-5 tables with well-known query patterns.

## Decision
SQLite via better-sqlite3 with WAL mode. Raw SQL with prepared statements. No ORM.

## Alternatives Considered

### Alternative 1: SQLite via sql.js (pure JavaScript)
- Pure JS, works everywhere without native compilation.
- Slower than better-sqlite3 (~5-10x for writes). Limited WAL mode support.
- No prebuilt binary issues.
- Rejection: Performance matters for high-frequency event ingestion. Kept as fallback if better-sqlite3 native bindings fail on an edge-case platform.

### Alternative 2: SQLite via Drizzle ORM
- Type-safe queries. Schema-as-code. Migration generation.
- Adds async query layer (unnecessary -- better-sqlite3 is synchronous by design).
- Learning curve for ORM abstractions. Query builder overhead for 5 tables.
- Rejection: For 4-5 tables with well-known queries, raw SQL is simpler and more transparent. Drizzle adds a dependency and abstraction layer without proportional benefit.

### Alternative 3: DuckDB
- Excellent for analytical queries (columnar). Native OLAP.
- Heavier than SQLite. Less mature in Node.js ecosystem. More complex setup.
- Rejection: Norbert's queries are primarily point lookups and simple aggregations, not OLAP workloads. DuckDB's strengths are not needed. Could be a future addition for analytics-heavy Phase 2+ features.

### Alternative 4: JSON file storage
- Simplest possible. No library needed.
- Does not support concurrent access safely. No indexing. Slow for large datasets.
- Rejection: Unsuitable once event count exceeds hundreds. No query capability.

## Consequences
- Positive: Zero-config -- no external database process to manage
- Positive: Synchronous API simplifies single-writer pattern
- Positive: WAL mode enables safe concurrent reads (CLI + dashboard server)
- Positive: Prebuilt binaries available for macOS, Linux, Windows (x64, ARM)
- Positive: Raw SQL is transparent -- no ORM magic, easy to debug
- Negative: Native addon requires prebuilt binary or compilation (mitigated by prebuild support)
- Negative: Raw SQL lacks compile-time type checking (mitigated by prepared statements and TypeScript wrapper functions)
- Negative: Schema changes require manual migration files
