# ADR-006: Navigation History LRU Cap of 50 Entries (Resolves OQ-6)

- **Status**: Accepted
- **Date**: 2026-04-21
- **Deciders**: Morgan, Phil
- **Scope**: config-cross-references feature v1

## Context

OQ-6 asked for history stack size policy. NFR-3 sets the non-functional budget.

Each history entry is `{ subTab, selectedItemKey, splitState, at: number }` — approximately 200 bytes on a conservative estimate. Upper bound:
- 50 entries × 200 B = 10 KB memory per Configuration view mount.
- 1000 entries would be ~200 KB — still small but no justifying user scenario.
- "Unbounded" over a long Norbert session could grow without natural cap.

Observed scenarios:
- Typical exploration session: 5-15 cross-reference clicks. Well below any cap.
- Power-user deep dive: 30-50 clicks within a single exploration. At or near cap.
- Long-running session (hours): many explorations separated by context switches. Each context switch doesn't push history (per OQ-2 resolution — ADR-008). So the cap still rarely fires.

## Decision

**LRU 50 entries per Configuration view mount.** When capacity is reached, push evicts the oldest entry (index 0), shifts all indices down, and adjusts `headIndex` accordingly.

### Invariants

1. `0 ≤ headIndex < entries.length` whenever `entries.length > 0`.
2. `entries.length ≤ 50`.
3. A new navigation action when `headIndex < entries.length - 1` clears the forward tail first (US-104 AC), then pushes.
4. A push when `entries.length === 50` evicts `entries[0]` and decrements `headIndex` by 1.

### Pure function signatures

```ts
// in domain/nav/history.ts
type HistoryEntry = Readonly<{ subTab: ConfigSubTab; selectedItemKey: string; splitState: SplitState | null; at: number }>;
type NavHistory   = Readonly<{ entries: readonly HistoryEntry[]; headIndex: number }>;

const MAX_HISTORY_ENTRIES = 50;

function pushEntry(h: NavHistory, entry: HistoryEntry): NavHistory;  // handles LRU + forward-clear
function goBack(h: NavHistory): NavHistory;                           // no-op at index 0
function goForward(h: NavHistory): NavHistory;                        // no-op at last index
function canGoBack(h: NavHistory): boolean;
function canGoForward(h: NavHistory): boolean;
```

## Considered Alternatives

### Alt A: Unbounded within session
- **Pros**: No data loss.
- **Cons**: No user benefit beyond ~50 (user has lost the mental thread anyway). Potential memory creep in long-running sessions.
- **Rejected**.

### Alt B: Configurable cap
- **Pros**: Power user flexibility.
- **Cons**: Settings surface, no demonstrated demand, complicates invariants documentation.
- **Rejected** for v1.

### Alt C: LRU 20
- **Pros**: Smaller footprint.
- **Cons**: Cap reached during realistic deep-dive sessions. Truncation becomes observable.
- **Rejected**: 50 is the sweet spot.

### Alt D: LRU 50 (chosen)
- **Pros**: Well above realistic chain length, still bounded.
- **Chosen**.

## Consequences

### Positive
- Predictable memory profile.
- Pure functions → property-testable (invariants above are natural fast-check properties).

### Negative
- Users performing >50 cross-ref clicks lose the earliest entries. Mitigated: entry 0 is almost certainly from a different exploration.

### Quality-attribute trade-offs
- **Reliability** ↑ (bounded state).
- **Usability**: neutral — cap is well above observed chain length.

## Implementation Notes (for software-crafter)

- `MAX_HISTORY_ENTRIES = 50` as an exported const, used from both the reducer and tests.
- Property-test candidate: `∀ sequence of actions: |entries| ≤ 50 ∧ 0 ≤ headIndex < |entries|` after each action.
- Emit `nav_history_restore` event from the instrumentation edge when `historyBack`/`historyForward` actions execute. Include `stack_depth: entries.length` as a field.
