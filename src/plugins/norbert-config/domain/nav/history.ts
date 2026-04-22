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
 * Eviction is enforced by {@link pushEntry} via {@link enforceLruCap}.
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
 * Drop the oldest entries from the front so the most-recent
 * {@link MAX_HISTORY_ENTRIES} survive. No-op when already within the cap.
 * The newest entry (caller-appended at the tail) is always retained as head.
 */
function enforceLruCap(entries: readonly NavEntry[]): readonly NavEntry[] {
  return entries.length > MAX_HISTORY_ENTRIES
    ? entries.slice(entries.length - MAX_HISTORY_ENTRIES)
    : entries;
}

/**
 * Append `entry` to the history, truncating any forward tail first so that a
 * new navigation action after Alt+Left clears the redo stack. When the
 * resulting stack would exceed {@link MAX_HISTORY_ENTRIES}, the oldest
 * entries are dropped from the front (LRU eviction per ADR-006). The new
 * entry is always the head, so `headIndex` ends at `entries.length - 1`.
 */
export function pushEntry(history: NavHistory, entry: NavEntry): NavHistory {
  const retained = history.entries.slice(0, history.headIndex + 1);
  const withNewHead = [...retained, entry];
  const capped = enforceLruCap(withNewHead);
  return {
    entries: capped,
    headIndex: capped.length - 1,
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
 * True iff {@link goBack} would change `headIndex`. Mirrors the lower-bound
 * guard in `goBack` and aligns with ADR-006 invariant 1
 * (`0 <= headIndex < entries.length`): back navigation is available only
 * while a strictly older entry exists in the stack.
 */
export function canGoBack(history: NavHistory): boolean {
  return history.headIndex > 0;
}

/**
 * True iff goForward would change `headIndex`. Mirrors the upper-bound guard
 * in {@link goForward} and aligns with ADR-006 invariant 2
 * (`headIndex < entries.length`): forward navigation is available only while
 * a strictly newer entry exists in the stack.
 */
export function canGoForward(history: NavHistory): boolean {
  return history.headIndex < history.entries.length - 1;
}
