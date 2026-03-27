# Technology Stack: Session Time Filter

No new dependencies. Feature uses only existing stack:

| Layer | Technology | Usage |
|-------|-----------|-------|
| Domain | TypeScript | Pure filter functions, discriminated union types |
| View | React | `useState` for filter selection, JSX for filter control |
| Test | Vitest | Acceptance tests for filter logic |

## Reuse Assessment

| Component | Decision | Rationale |
|-----------|----------|-----------|
| `isSessionActive` | Reuse | Already implements the "active now" predicate exactly |
| `SessionInfo` type | Reuse | Has all fields needed for filtering (`last_event_at`, `ended_at`) |
| `sortSessionsMostRecentFirst` | Reuse | Applied after filtering, unchanged |
| Filter control UI | New | Segmented button row in existing `sec-hdr` area |
