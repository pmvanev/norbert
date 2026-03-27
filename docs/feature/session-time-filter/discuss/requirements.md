# Requirements: Session Time Filter

## Functional Requirements

### FR-1: Filter control in Sessions header
The Sessions view header displays a filter control with options: Active Now, Last 15 min, Last hour, Last 24 hrs, All. Default selection is "All".

### FR-2: Active Now filter
"Active Now" shows only sessions where `isSessionActive(session)` returns true (not ended, event within 5 min).

### FR-3: Time window filters
Time window filters (15 min, 1 hour, 24 hours) include sessions whose `last_event_at` falls within the window OR that are currently active.

### FR-4: Session count reflects filter
The header count (currently "N total") updates to reflect the number of sessions matching the active filter.

### FR-5: Filter persistence
The selected filter is React component state within SessionListView. It persists when navigating to session detail and back. It resets when SessionListView unmounts (user closes the Sessions panel) and on app restart, defaulting to "All".

### FR-6: Empty filter state
When no sessions match the filter, display "No sessions in this time window" instead of the session list.

## Non-Functional Requirements

### NFR-1: Pure domain logic
Filter functions are pure (no side effects, testable without DOM). Filter predicate lives in domain layer, not in the view.

### NFR-2: No backend changes
Filtering is client-side only. All data needed (`last_event_at`, `ended_at`, `started_at`) already exists on `SessionInfo`.

### NFR-3: Performance
Filtering is O(n) over sessions array. No concern at expected scale (hundreds of sessions max).

## Technical Notes

### Timezone handling
All `SessionInfo` timestamps (`started_at`, `ended_at`, `last_event_at`) are ISO 8601 strings parsed via `new Date()`, yielding UTC epoch milliseconds. `Date.now()` returns UTC epoch milliseconds. All filter comparisons operate on epoch values, making them timezone-agnostic. The UI displays timestamps in the user's locale (via `toLocaleString`) but filtering logic never touches local time.

### `isSessionActive` (existing function)
Defined in `src/domain/status.ts`. Returns `true` when `ended_at === null` AND `last_event_at` is within 5 minutes of `now`. The "Active Now" filter delegates to this function.
