/**
 * Navigation History (LRU stack)
 *
 * Pure domain module for the Configuration view's Alt+Left/Alt+Right cross-
 * reference navigation history (US-104, ADR-006). Models a head-indexed
 * snapshot stack with a 50-entry LRU cap and a forward-clear-on-push rule.
 *
 * Driving port (architecture sec 6.5):
 *   pushEntry(history, entry) -> NavHistory   -- truncates forward tail, appends
 *   goBack(history)           -> NavHistory   -- decrements headIndex, no-op at 0
 *   goForward(history)        -> NavHistory   -- increments headIndex, no-op at end
 *   canGoBack(history)        -> boolean
 *   canGoForward(history)     -> boolean
 *
 * Constraints:
 *   - Pure functions only (no classes, no mutation of inputs)
 *   - Readonly types throughout
 *   - No React, no Tauri, no IO
 *
 * Step 03-01 scope: types + emptyHistory sentinel + goBack happy path. The
 * remaining four functions are implemented as minimal placeholders that
 * preserve the readonly contract; full behaviour lands in steps 03-02..03-06.
 */

/**
 * Opaque snapshot record. The concrete shape (subTab, selectedItemKey,
 * splitState, at) is fixed at the reducer integration step (03-06); within
 * the pure history module an entry is treated as an opaque readonly record
 * so this module stays decoupled from the reducer's view-model.
 */
export type NavEntry = Readonly<Record<string, unknown>>;

export interface NavHistory {
  readonly entries: readonly NavEntry[];
  readonly headIndex: number;
}

/**
 * LRU cap on history depth. Non-configurable per ADR-006: chosen to sit
 * comfortably above realistic deep-dive chain length while bounding memory.
 * Used by both the reducer and tests; eviction logic lands in step 03-06.
 */
export const MAX_HISTORY_ENTRIES = 50;

/**
 * Sentinel empty history. `headIndex = -1` encodes "no head yet" — the only
 * representable state where `entries.length === 0`. Once an entry is pushed,
 * `headIndex` enters its normal `0 <= headIndex < entries.length` range
 * (ADR-006 invariants).
 */
export const emptyHistory: NavHistory = {
  entries: [],
  headIndex: -1,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Append `entry` to the history, truncating any forward tail first so that a
 * new navigation action after Alt+Left clears the redo stack.
 *
 * Step 03-01 minimal body: no LRU eviction yet (the 4-entry walking-skeleton
 * fixture is well under the 50-entry cap). Eviction lands in step 03-06.
 */
export function pushEntry(history: NavHistory, entry: NavEntry): NavHistory {
  const keep = history.entries.slice(0, history.headIndex + 1);
  const nextEntries = [...keep, entry];
  return {
    entries: nextEntries,
    headIndex: nextEntries.length - 1,
  };
}

/**
 * Move the head one step back. No-op when already at the start (headIndex
 * <= 0); the entries array is preserved in either case.
 */
export function goBack(history: NavHistory): NavHistory {
  if (history.headIndex <= 0) {
    return history;
  }
  return {
    entries: history.entries,
    headIndex: history.headIndex - 1,
  };
}

/**
 * Move the head one step forward. No-op when already at the end
 * (`headIndex >= entries.length - 1`); the entries array is preserved in
 * either case. Symmetric to {@link goBack}.
 */
export function goForward(history: NavHistory): NavHistory {
  if (history.headIndex >= history.entries.length - 1) {
    return history;
  }
  return {
    entries: history.entries,
    headIndex: history.headIndex + 1,
  };
}

/**
 * True iff goBack would change `headIndex`. Final semantics already aligned
 * with ADR-006 invariant 1 (`0 <= headIndex < entries.length`); refined
 * exposure lands with the reducer integration in step 03-04.
 */
export function canGoBack(history: NavHistory): boolean {
  return history.headIndex > 0;
}

/**
 * Placeholder: real implementation lands in step 03-05. Conservatively
 * returns false so any premature consumer treats the forward action as
 * unavailable rather than silently allowing it.
 */
export function canGoForward(_history: NavHistory): boolean {
  return false;
}
