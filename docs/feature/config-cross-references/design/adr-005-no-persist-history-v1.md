# ADR-005: No Persisted Navigation History in v1 (Resolves OQ-7)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature v1

## Context

OQ-7 asked whether navigation history should survive Norbert restarts. D7 (DISCUSS) tentatively locked "no". This ADR confirms and documents the v1 scope decision.

Relevant KPIs and stories:

- US-114 (R3, deferred) is the designated story for persisted history if user research demonstrates demand.
- KPI #2 (week-1 → week-2 retention ≥ 50%) is the primary signal that would trigger R3 investment.
- NFR-3: history capped at LRU 50 entries; worst-case ~10 KB. Negligible in memory, but not trivially negligible in a persisted blob (serialisation + schema migrations).

## Decision

**No persistence in v1.** History lives entirely in the Provider's `useReducer` state and is discarded on:

- Configuration view unmount (e.g. user switches to Sessions view and back — history resets)
- Norbert window close
- Norbert app quit

Rationale for discarding on view unmount (stronger than just "on restart"): history is scoped to an active Configuration session. When the user switches away and comes back, they likely have a new intent. Preserving cross-switch history would mean restoring state the user didn't ask for — a surprise.

## Considered Alternatives

### Alt A: Persist to `localStorage` keyed by workspace path
- **Pros**: Survives restart. Cheap to implement (LRU 50 × ~200 B = 10 KB).
- **Cons**: Introduces schema migrations when history entry shape changes. Storing `selectedItemKey` that may reference a file that was deleted between sessions means restored history can have dead entries. Surfaces edge cases (workspace renamed, user cleared localStorage) that demand UX design work belonging to US-114.
- **Deferred** to US-114 (R3) — appropriate scope for the UX design work required.

### Alt B: Persist to SQLite via the existing Tauri backend
- **Pros**: Consistent with where other Norbert data lives.
- **Cons**: Requires a new backend IPC command (migrations, concurrent access, cross-window coordination). Massive scope creep for a trust-probation feature.
- **Deferred** to US-114.

### Alt C: Persist across view unmount but not restart (session-storage-like)
- **Pros**: Preserves in-tab context.
- **Cons**: Same "surprise on return" problem as A. Solves no observable pain point.
- **Rejected**.

### Alt D: In-memory only, reset on unmount (chosen)
- **Pros**: Simplest. Zero persistence surface. No schema. No migration path to maintain. Matches what DISCUSS locked as D7.
- **Chosen**.

## Consequences

### Positive
- Zero persistence-layer complexity.
- Reducer remains a pure function with no IO.
- If KPI #2 is low, we learn fast and can still reach for US-114 without sunk cost.

### Negative
- Power users who close Norbert mid-exploration lose their trail. Mitigated: we are explicit about this in documentation; also, Alt+Left is only useful within an active exploration — closing Norbert is usually a signal the exploration is done.

### Quality-attribute trade-offs
- **Simplicity / Maintainability** ↑↑
- **Reliability / Recoverability** ↓ slightly (trails are lost across restart). Acceptable for v1.

## Implementation Notes (for software-crafter)

- Do not add any localStorage/sessionStorage/Tauri-store integration for navigation state in v1.
- If telemetry on KPI #2 in week 4 shows retention < 40%, flag to product for US-114 consideration.
