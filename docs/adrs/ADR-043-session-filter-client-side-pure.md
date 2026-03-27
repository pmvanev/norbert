# ADR-043: Client-Side Pure Function Session Filtering

## Status

Accepted

## Context

The Sessions view shows all sessions in a flat list sorted by recency. Users need to filter by "active now" or recent time windows (15 min, 1 hour, 24 hours) to focus on relevant sessions.

## Decision

Implement filtering as a pure domain function (`filterSessions`) with a discriminated union type (`SessionFilterId`) and const preset array. Filter state lives as React `useState` in `SessionListView` — no backend query changes, no new IPC commands.

## Alternatives Considered

### Backend-side filtering via new Tauri command
- Pros: Reduces data transferred over IPC
- Cons: Adds Rust code, new IPC contract, coupling between UI filter options and SQL queries
- Rejected: At expected scale (hundreds of sessions), client-side filtering is O(n) with negligible cost. Backend filtering adds complexity with no measurable benefit.

### Global state (context/store) for filter selection
- Pros: Filter persists across view transitions without prop drilling
- Cons: Adds state management complexity for a single component's local concern
- Rejected: FR-5 specifies filter resets on unmount. Local `useState` is the right scope.

## Consequences

- Filter logic is 100% pure and testable without React or DOM
- Adding new filter options requires only a new entry in `SESSION_FILTER_PRESETS`
- No backend changes, no migration, no new IPC commands
- Filter resets on SessionListView unmount (by design — FR-5)
