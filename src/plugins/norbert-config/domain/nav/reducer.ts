/**
 * ConfigNavReducer
 *
 * Pure domain module that owns Configuration-view-scoped navigation state.
 * The reducer is the single driving port for state transitions per
 * architecture.md section 6.4 and ADR-002 (one source of truth, one update
 * path). All state transitions are pure total functions on
 * (state, action) -> state.
 *
 * Walking-skeleton scope (Step 04-01):
 *   - ConfigNavState shape with splitState, history, filter, transient cues.
 *   - SplitState fixed-shape per ADR-009 (a third pane is a compile-time
 *     error -- the type carries exactly topRef and bottomRef).
 *   - ConfigNavAction discriminated union of 5 walking-skeleton variants.
 *     Other variants land in steps 04-02..04-12.
 *   - reduce() implements only the `refSingleClick on a live ref` branch;
 *     all other action tags fall through to the exhaustiveness default and
 *     return state unchanged. The `never` default will start failing
 *     compilation as soon as a 6th action variant is added without a case,
 *     restoring TDD discipline for subsequent steps.
 *
 * Constraints:
 *   - Pure functions only (no classes, no mutation of inputs)
 *   - Readonly types throughout (immutable state)
 *   - No React, no Tauri, no node:* imports
 */

import type { ConfigSubTab } from "../types";
import type { RegistryEntry } from "../references/registry";
import type { ResolvedRef } from "../references/resolver";
import { pushEntry, type NavEntry, type NavHistory } from "./history";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

/**
 * Two-pane vertical split. Per ADR-009 the split is a fixed-shape record so
 * a third pane is a compile-time impossibility -- the type system, not a
 * runtime invariant, enforces the 2-pane contract. `dividerRatio` is in
 * [0, 1]; the walking skeleton uses 0.5 (an even split).
 */
export interface SplitState {
  readonly topRef: RegistryEntry;
  readonly bottomRef: RegistryEntry;
  readonly dividerRatio: number;
}

/**
 * Per-sub-tab filter state. `source` is the active source filter (user,
 * project, plugin id, or null for unfiltered). `sort` is the active sort
 * order. Walking-skeleton initial state has no per-tab entries so the
 * reducer treats absence as `{ source: null, sort: 'name' }`.
 */
export interface FilterByTab {
  readonly source: string | null;
  readonly sort: "name" | "source";
}

/**
 * Configuration-view navigation state. Carries:
 *   - `activeSubTab`, `selectedItemKey`: current list-pane focus
 *   - `splitState`: optional bottom preview pane (ADR-009)
 *   - `history`: NavHistory snapshot stack for Alt+Left/Right (US-104)
 *   - `filter.bySubTab`: persisted per-sub-tab filter state
 *   - `filterResetCue`: transient -- Provider clears after announcing
 *     (ADR-007)
 *   - `endOfHistory`: transient end-of-history bump cue ('back' or 'forward')
 *   - `popover`: milestone-1 placeholder for ambiguous-target popover state
 */
export interface ConfigNavState {
  readonly activeSubTab: ConfigSubTab;
  readonly selectedItemKey: string | null;
  readonly splitState: SplitState | null;
  readonly history: NavHistory;
  readonly filter: { readonly bySubTab: Readonly<Record<string, FilterByTab>> };
  readonly filterResetCue: ConfigSubTab | null;
  readonly endOfHistory: "back" | "forward" | null;
  readonly popover: null;
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

/**
 * Walking-skeleton action union. Five variants suffice to drive the
 * milestone-0 scenarios in walking-skeleton.feature and reducer.test.ts.
 * Steps 04-02..04-12 will extend this union with:
 *   - navigateBack / navigateForward (US-104)
 *   - replayHistoryEntry (US-104 integration)
 *   - setFilter / clearFilter (US-105)
 *   - openAmbiguousPopover / closeAmbiguousPopover (US-103)
 *   - dismissUnsupported (US-101 unsupported branch)
 *   - acknowledgeFilterReset (ADR-007 transient cue clearing)
 *   - acknowledgeEndOfHistory (ADR-006 transient cue clearing)
 *
 * The compiler will flag every reduce() default branch that needs a new
 * case as soon as a variant lands, so the never-exhaustiveness check below
 * acts as a TDD ratchet.
 */
export type ConfigNavAction =
  | {
      readonly tag: "refSingleClick";
      readonly ref: ResolvedRef;
      readonly currentEntry: RegistryEntry | null;
    }
  | { readonly tag: "refCtrlClick"; readonly ref: ResolvedRef }
  | {
      readonly tag: "selectItem";
      readonly subTab: ConfigSubTab;
      readonly itemKey: string;
    }
  | { readonly tag: "switchSubTab"; readonly subTab: ConfigSubTab }
  | { readonly tag: "closeSplit" };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Build a NavEntry capturing the just-completed cross-reference action.
 * The opaque `action`/`targetItemKey` shape is sufficient for milestone-0
 * history depth tests; the concrete `HistoryEntry` shape from ADR-006
 * lands when needed for the live-cue announcer (Step 04-09 / US-104).
 */
function makeRefClickEntry(
  action: "refSingleClick" | "refCtrlClick",
  targetItemKey: string,
): NavEntry {
  return { action, targetItemKey };
}

/**
 * Handle the `refSingleClick` branch.
 *
 * Step 04-01 scope: a live ref with a non-null current entry opens the
 * split with current on top, target on bottom, and pushes a history entry.
 * All other sub-cases (split-already-open swap, dead/ambiguous/unsupported
 * branches, missing-anchor handling) land in 04-02..04-09 and currently
 * fall through to a state-unchanged return.
 */
function handleRefSingleClick(
  state: ConfigNavState,
  ref: ResolvedRef,
  currentEntry: RegistryEntry | null,
): ConfigNavState {
  if (ref.tag !== "live") {
    return state;
  }
  if (currentEntry === null) {
    return state;
  }
  const newSplit: SplitState = {
    topRef: currentEntry,
    bottomRef: ref.entry,
    dividerRatio: 0.5,
  };
  return {
    ...state,
    splitState: newSplit,
    history: pushEntry(state.history, makeRefClickEntry("refSingleClick", ref.entry.itemKey)),
  };
}

/**
 * Reduce a {@link ConfigNavState} by applying a {@link ConfigNavAction}.
 *
 * Pure total function: every action tag is dispatched to a small named
 * handler (or returns state unchanged in the 04-01 walking-skeleton scope).
 * The `never`-typed default branch enforces compile-time exhaustiveness:
 * a future action variant added to {@link ConfigNavAction} without a
 * matching case here is a type error at the assignment site.
 */
export function reduce(
  state: ConfigNavState,
  action: ConfigNavAction,
): ConfigNavState {
  switch (action.tag) {
    case "refSingleClick":
      return handleRefSingleClick(state, action.ref, action.currentEntry);
    case "refCtrlClick":
    case "selectItem":
    case "switchSubTab":
    case "closeSplit":
      // Walking-skeleton placeholder: implementations land in 04-02..04-12.
      return state;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
