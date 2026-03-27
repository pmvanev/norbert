# Journey: Session Time Filter

## Happy Path

```
[Open Sessions View] --> [See filter control in header] --> [Select time window] --> [List updates] --> [See filtered count]
      |                        |                                 |                       |                    |
   Neutral              "I can scope this"              "Last 15 min"           "Just 3 sessions"     "That's my window"
                                                     or "Active now"
```

## Steps

### Step 1: User opens Sessions view
- **Action**: Click Sessions in sidebar or navigate to session list
- **Sees**: Full session list with filter control in the header area
- **Feels**: Neutral — same entry point as before
- **Artifact**: `${sessions}` (all sessions from backend)

### Step 2: User notices filter control
- **Action**: Scan header area
- **Sees**: Filter control showing current selection (default: "All") alongside session count
- **Feels**: Recognition — "I can scope this down"
- **Artifact**: `${selectedFilter}` (default "All")

### Step 3: User selects a time window
- **Action**: Click a filter option (Active Now | Last 15 min | Last hour | Last 24 hrs | All)
- **Sees**: List immediately updates to show matching sessions; count updates
- **Feels**: Control — "That's exactly what I need"
- **Artifact**: `${filteredSessions}`, `${filteredCount}`

### Step 4: User works with filtered list
- **Action**: Click a session row to open detail view
- **Sees**: Session detail for the selected session; filter persists when returning
- **Feels**: Confidence — filter didn't reset, context preserved

## Error / Edge Paths

### No sessions match the filter
- **Sees**: Empty state message: "No sessions in this time window"
- **Feels**: Informed, not broken — clear that the filter is active and narrowing results
- **Recovery**: Select a broader time window or "All"

### All sessions are old (none active)
- **Sees**: "Active Now" shows 0 sessions with empty state
- **Feels**: Correct — confirms nothing is running right now
