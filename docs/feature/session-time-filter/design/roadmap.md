# Implementation Roadmap: Session Time Filter

## Step 1: Domain filter module (US-1, US-2)
**File**: `src/domain/sessionFilter.ts`
**Test**: `tests/acceptance/session-time-filter/session-filter.test.ts`

Create `SessionFilterId` type, `SESSION_FILTER_PRESETS` array, `filterSessions` function, and `isWithinWindow` helper. All pure functions with `now` parameter for deterministic testing.

Covers:
- "Active Now" filter delegating to existing `isSessionActive`
- Time window filters (15m, 1h, 24h) checking `last_event_at`
- "All" passthrough filter
- Edge: session spanning boundary (started before window, active within)
- Edge: `last_event_at === null` excluded from time windows

## Step 2: Filter control in SessionListView header (US-3, US-4)
**File**: `src/views/SessionListView.tsx`

Add `useState<SessionFilterId>('all')`, render segmented filter buttons in `sec-hdr`, call `filterSessions` before mapping rows. Update header count from `sessions.length` to `filteredSessions.length`. Show "No sessions in this time window" when filtered result is empty.

## Step 3: Styling
**File**: CSS for filter control buttons (segmented style matching existing `sec-hdr` aesthetic)

Style the filter buttons: selected state, hover, compact layout within the header row.
