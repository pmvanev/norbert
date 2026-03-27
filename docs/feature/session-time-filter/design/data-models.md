# Data Models: Session Time Filter

## New Types

### `SessionFilterId` (discriminated union)

```typescript
type SessionFilterId = 'active-now' | 'last-15m' | 'last-1h' | 'last-24h' | 'all'
```

### `SessionFilterPreset` (record type)

```typescript
interface SessionFilterPreset {
  readonly id: SessionFilterId
  readonly label: string
  readonly predicate: (session: SessionInfo, now: number) => boolean
}
```

### `SESSION_FILTER_PRESETS` (const array)

```typescript
const SESSION_FILTER_PRESETS: ReadonlyArray<SessionFilterPreset>
```

Five entries, one per filter option. Each preset's predicate is a pure function.

## Existing Types (reused, unchanged)

### `SessionInfo` (from `src/domain/status.ts`)

```typescript
interface SessionInfo {
  readonly id: string
  readonly started_at: string        // ISO 8601
  readonly ended_at: string | null   // null = still open
  readonly event_count: number
  readonly last_event_at: string | null  // null = no events yet
}
```

## Pure Function Signatures

### `filterSessions`

```typescript
const filterSessions: (
  sessions: ReadonlyArray<SessionInfo>,
  filterId: SessionFilterId,
  now: number,
) => ReadonlyArray<SessionInfo>
```

### `getFilterPreset`

```typescript
const getFilterPreset: (
  filterId: SessionFilterId,
) => SessionFilterPreset
```

### `isWithinWindow` (internal helper)

```typescript
const isWithinWindow: (
  session: SessionInfo,
  windowMs: number,
  now: number,
) => boolean
```

Returns true when `session.last_event_at` is within `windowMs` of `now`. Sessions with `last_event_at === null` return false.
