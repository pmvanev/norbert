# Component Boundaries: Session Time Filter

## New Module

### `src/domain/sessionFilter.ts`
- **Owns**: `SessionFilterId` type, `SESSION_FILTER_PRESETS` const array, `filterSessions` function
- **Depends on**: `SessionInfo` and `isSessionActive` from `src/domain/status.ts`
- **Depended on by**: `SessionListView`
- **Test file**: `tests/acceptance/session-time-filter/session-filter.test.ts`
- **Purity**: 100% pure — all functions take `now` as parameter, no `Date.now()` calls

## Modified Module

### `src/views/SessionListView.tsx`
- **Change**: Add `useState<SessionFilterId>` (default "all"), render filter control in `sec-hdr`, apply `filterSessions` before mapping rows, update count display
- **New dependency**: `sessionFilter.ts`
- **No new props**: Filter state is local to this component (FR-5)

## Unchanged Modules

- `src/domain/status.ts` — reused as-is
- `src/domain/sessionPresentation.ts` — reused as-is
- Tauri backend — no changes
- `App.tsx` — continues passing `sessions` prop unchanged

## Dependency Graph

```
SessionListView.tsx
  ├── domain/sessionFilter.ts (NEW)
  │     └── domain/status.ts (isSessionActive, SessionInfo)
  ├── domain/status.ts (sortSessionsMostRecentFirst, formatSessionDuration, etc.)
  └── domain/sessionPresentation.ts (deriveSessionRowClass, etc.)
```
