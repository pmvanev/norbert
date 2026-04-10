# Walking Skeleton: Session Metrics Table

## Skeleton Definition

The walking skeleton for session-metrics-table proves a user can:
1. See their sessions as a table with status indicators and project names (WS-1)
2. Compare costs and token usage across sessions at a glance (WS-2)
3. Select a session row to open the detail panel (WS-3)

## WS-1: Table Renders with Status and Name (First to Implement)

**User goal**: "I open the Sessions tab and see my sessions in a table with their names and activity status."

**Observable outcome**: Each session appears as a table row. Active sessions show a pulsing green indicator. The project folder name (derived from cwd) identifies each session.

**Driving port**: `buildTableRows(sessions, metrics, metadata, now)` — pure function that transforms SessionInfo + SessionMetrics + SessionMetadata into an array of TableRow objects containing status, name, and all column values.

**Existing domain reused**:
- `isSessionActive(session, now)` — determines active vs completed status
- `deriveSessionName(cwd, fallback)` — extracts project name from path

**Thin vertical slice**: SessionInfo from backend -> buildTableRows -> TableRow[] with status + name fields. View layer renders table rows from this data.

## WS-2: Cost and Token Comparison

**User goal**: "I compare how much each session is costing and consuming without clicking into each one."

**Observable outcome**: Cost column shows USD-formatted values. Tokens column shows K-suffix formatted counts.

**New pure functions needed**:
- `formatCostColumn(cost: number) -> string` — e.g., 1.24 -> "$1.24"
- `formatTokenColumn(tokens: number) -> string` — e.g., 142500 -> "142.5K"

## WS-3: Row Selection

**User goal**: "I click a session to see its detailed metrics dashboard."

**Observable outcome**: The row highlights and the detail panel opens.

**Driving port**: Row click returns sessionId to `onSessionSelect` callback (same contract as current SessionListView).

## Implementation Order

WS-1 is the first enabled test. It will fail because `buildTableRows` does not exist yet. The software-crafter implements the pure domain function to make it pass, then enables WS-2, and so on.
