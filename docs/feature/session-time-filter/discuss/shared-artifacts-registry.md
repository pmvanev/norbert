# Shared Artifacts Registry: Session Time Filter

| Artifact | Type | Source | Consumers |
|----------|------|--------|-----------|
| `sessions` | `ReadonlyArray<SessionInfo>` | Tauri IPC `get_sessions` (polled in App.tsx) | SessionListView, filter logic |
| `selectedFilter` | `SessionFilterId` | UI state in SessionListView | Filter logic, header count |
| `filteredSessions` | `ReadonlyArray<SessionInfo>` | Pure filter function applied to `sessions` | SessionListView rendering |
| `filteredCount` | `number` | `filteredSessions.length` | Header display |
| `now` | `number` | `Date.now()` at filter evaluation time | `isSessionActive`, recency comparisons |
