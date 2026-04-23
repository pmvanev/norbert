/**
 * ConfigNavReducer
 *
 * Pure domain module that owns Configuration-view-scoped navigation state.
 * The reducer is the single driving port for state transitions per
 * architecture.md section 6.4 and ADR-002 (one source of truth, one update
 * path). All state transitions are pure total functions on
 * (state, action) -> state.
 *
 * Public surface (stable for downstream Provider consumption):
 *   - {@link reduce}            the driving port
 *   - {@link ConfigNavState}    full navigation state shape
 *   - {@link ConfigNavAction}   discriminated union of dispatchable actions
 *   - {@link SplitState}        fixed-shape 2-pane split (ADR-009)
 *   - {@link FilterByTab}       per-sub-tab filter cell
 *
 * Architectural invariants enforced here:
 *   - SplitState is a fixed-shape record -- a third pane is a compile-time
 *     error, not a runtime check (ADR-009).
 *   - The `default: never` exhaustiveness branch in {@link reduce} flags any
 *     ConfigNavAction variant added to the union without a matching case as
 *     a type error at the assignment site.
 *   - Cross-ref actions push exactly one history entry; manual selection
 *     and sub-tab switches do not (ADR-008).
 *   - Filter on cross-ref nav: preserved when the destination filter
 *     already shows the target, reset (with a cue) when it would hide it,
 *     never touched when the destination has no active filter (ADR-007).
 *
 * Constraints:
 *   - Pure functions only (no classes, no mutation of inputs)
 *   - Readonly types throughout (immutable state)
 *   - No React, no Tauri, no node:* imports
 */

import type { ConfigSubTab } from "../types";
import type { RefType, RegistryEntry } from "../references/registry";
import type { ResolvedRef } from "../references/resolver";
import { pushEntry, type NavEntry, type NavHistory } from "./history";

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

/**
 * Disambiguation popover state. Forward-declaration stub for milestone-1; the
 * concrete shape lands when the `openDisambiguation` action is implemented in
 * a future phase. ADR-002 specifies the canonical shape as
 * `{ trigger, candidates, highlightedIndex, triggerInteraction }`. Defining
 * the type now (with `null` initialised at every construction site) lets a
 * future `openDisambiguation` action become a purely additive change instead
 * of an interface widening that cascades to every ConfigNavState construction
 * site (initialNavState, every reducer return). All current call sites that
 * write `popover: null` remain valid against this widened type.
 */
export type DisambiguationState = Readonly<{
  readonly trigger: "refSingleClick" | "refCtrlClick";
  readonly candidates: readonly RegistryEntry[];
  readonly highlightedIndex: number;
}>;

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
  readonly popover: DisambiguationState | null;
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

/**
 * Discriminated union of actions {@link reduce} accepts. Each variant maps
 * to one case in the reducer; the `default: never` branch enforces
 * compile-time exhaustiveness so adding a new variant without a matching
 * case is a type error at the assignment site.
 *
 *   - `refSingleClick`   open or replace the bottom of the 2-pane split
 *                        (ADR-009); pushes one history entry on a live ref.
 *   - `refCtrlClick`     atomic cross-tab navigation (ADR-002 sec 6.7);
 *                        closes any open split and pushes one history entry.
 *   - `selectItem`       manual list-row selection; updates focus, does NOT
 *                        push history (ADR-008).
 *   - `switchSubTab`     manual mode-switch; resets selection, does NOT push
 *                        history (ADR-008, Architecture sec 6.4).
 *   - `closeSplit`       collapse the 2-pane split (ADR-009); pushes one
 *                        history entry (ADR-008).
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
 * Build a NavEntry capturing the just-completed cross-reference action. The
 * `source` provenance key aligns with ADR-008's contract (every history entry
 * carries `{ source: 'refSingleClick' | 'refCtrlClick' | 'bottomReplace' |
 * 'closeSplit' | 'disambiguation' }`). The opaque `source`/`targetItemKey`
 * shape is sufficient for milestone-0 history depth tests; the concrete
 * `HistoryEntry` shape from ADR-006 lands when needed for the live-cue
 * announcer (Step 04-09 / US-104).
 */
function makeRefClickEntry(
  source: "refSingleClick" | "refCtrlClick",
  targetItemKey: string,
): NavEntry {
  return { source, targetItemKey };
}

/**
 * Pure mapping from a registry entry's {@link RefType} to the
 * {@link ConfigSubTab} that surfaces items of that type in the Configuration
 * view. Encoded as a total `Record<RefType, ConfigSubTab>` so adding a new
 * RefType is a compile-time error here until the mapping is extended --
 * the type system, not a runtime check, keeps cross-tab navigation in sync
 * with the registry surface.
 *
 * Most types pluralise (`agent` -> `agents`); `mcp` is intentionally
 * identical because the sub-tab id is also `mcp`.
 */
const REF_TYPE_TO_SUB_TAB: Readonly<Record<RefType, ConfigSubTab>> = {
  agent: "agents",
  command: "commands",
  skill: "skills",
  hook: "hooks",
  mcp: "mcp",
  rule: "rules",
  plugin: "plugins",
};

function refTypeToSubTab(type: RefType): ConfigSubTab {
  return REF_TYPE_TO_SUB_TAB[type];
}

/**
 * Decide whether the destination sub-tab's source filter should be preserved
 * or reset on a cross-reference navigation, per ADR-007.
 *
 * Rules (in order):
 *   1. No active filter on the target sub-tab     -> preserve, no cue.
 *   2. Active filter source matches target source -> preserve, no cue.
 *   3. Mismatch                                   -> clear only the target
 *                                                    sub-tab's `source` (sort
 *                                                    preserved), emit cue.
 *
 * The cue is either `null` (no announcement) or the destination sub-tab id;
 * the Provider reads it, announces "filter cleared on <tab>", then dispatches
 * an acknowledge action that sets it back to null. The reset is scoped to
 * the target sub-tab only -- unrelated filters in `bySubTab` are spread
 * through unchanged so a filter on the source sub-tab survives the
 * cross-reference navigation.
 */
function resolveFilterOnNav(
  prevFilter: ConfigNavState["filter"],
  targetSubTab: ConfigSubTab,
  targetSource: string,
): { readonly filter: ConfigNavState["filter"]; readonly resetCue: ConfigSubTab | null } {
  const existing = prevFilter.bySubTab[targetSubTab];
  if (existing === undefined || existing.source === null) {
    // Rule 1: no filter to preserve or reset.
    return { filter: prevFilter, resetCue: null };
  }
  if (existing.source === targetSource) {
    // Rule 2: filter already shows the target -- preserve verbatim.
    return { filter: prevFilter, resetCue: null };
  }
  // Rule 3: mismatch -- clear the source dimension and emit the cue naming
  // the destination sub-tab.
  return {
    filter: {
      bySubTab: {
        ...prevFilter.bySubTab,
        [targetSubTab]: { ...existing, source: null },
      },
    },
    resetCue: targetSubTab,
  };
}

/**
 * Handle the `refCtrlClick` branch.
 *
 * Per ADR-002 / architecture sec 6.7, a Ctrl+click on a live cross-reference
 * commits the navigation in a single returned state -- no intermediate
 * render. Six fields are updated atomically:
 *   - `activeSubTab`     : derived from the target's RefType
 *   - `selectedItemKey`  : the target's itemKey
 *   - `splitState`       : forced to null (Ctrl+click closes any open split
 *                          as part of the commit)
 *   - `history`          : exactly one entry pushed (ADR-008)
 *   - `filter`           : preserved or reset per {@link resolveFilterOnNav}
 *                          (ADR-007)
 *   - `filterResetCue`   : null or the destination sub-tab id, per the same
 *                          helper. Always overwritten -- the cue describes
 *                          THIS navigation's outcome, never a prior backlog.
 *
 * Non-live targets (dead, ambiguous, unsupported) are a complete no-op:
 * the early-return guard returns `state` verbatim so the same reference
 * propagates through the dispatch.
 */
function handleRefCtrlClick(
  state: ConfigNavState,
  ref: ResolvedRef,
): ConfigNavState {
  if (ref.tag !== "live") {
    return state;
  }
  const targetSubTab = refTypeToSubTab(ref.entry.type);
  const { filter, resetCue } = resolveFilterOnNav(
    state.filter,
    targetSubTab,
    ref.entry.source,
  );
  return {
    ...state,
    activeSubTab: targetSubTab,
    selectedItemKey: ref.entry.itemKey,
    splitState: null,
    history: pushEntry(state.history, makeRefClickEntry("refCtrlClick", ref.entry.itemKey)),
    filter,
    filterResetCue: resetCue,
  };
}

/**
 * Handle the `refSingleClick` branch.
 *
 * Two structural sub-cases (per ADR-009 the 2-slot SplitState shape makes a
 * third pane impossible, so these two exhaust the live-ref space):
 *
 *   1. `state.splitState === null` (open-from-empty):
 *      a non-null `currentEntry` becomes the new top, the target becomes
 *      the bottom, and a history entry is pushed. A null `currentEntry`
 *      is a no-op -- there is no anchor to open against.
 *
 *   2. `state.splitState !== null` (bottom-replace):
 *      the existing `topRef` is preserved as the top anchor (the action's
 *      `currentEntry` is intentionally ignored here -- the user's spatial
 *      anchor is the open top pane, not the list selection), the target
 *      becomes the new bottom, `dividerRatio` is preserved, and a history
 *      entry is pushed. This preserves the user's mental model: the top
 *      pane stays put while successive single-clicks scan through bottoms.
 *
 * Non-live targets (dead, ambiguous, unsupported) are a complete no-op:
 * the early-return guard returns `state` verbatim.
 */
function handleRefSingleClick(
  state: ConfigNavState,
  ref: ResolvedRef,
  currentEntry: RegistryEntry | null,
): ConfigNavState {
  if (ref.tag !== "live") {
    return state;
  }
  if (state.splitState !== null) {
    const replacedSplit: SplitState = {
      topRef: state.splitState.topRef,
      bottomRef: ref.entry,
      dividerRatio: state.splitState.dividerRatio,
    };
    return {
      ...state,
      splitState: replacedSplit,
      history: pushEntry(state.history, makeRefClickEntry("refSingleClick", ref.entry.itemKey)),
    };
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
 * handler or to an inline branch at the same abstraction level. The
 * `never`-typed default branch enforces compile-time exhaustiveness: a
 * future action variant added to {@link ConfigNavAction} without a matching
 * case here is a type error at the assignment site.
 */
export function reduce(
  state: ConfigNavState,
  action: ConfigNavAction,
): ConfigNavState {
  switch (action.tag) {
    case "refSingleClick":
      return handleRefSingleClick(state, action.ref, action.currentEntry);
    case "refCtrlClick":
      return handleRefCtrlClick(state, action.ref);
    case "selectItem":
      // Manual list-row selection updates focus but MUST NOT push history
      // (ADR-008 -- only cross-ref actions push). `history` is left untouched
      // so a mid-history `headIndex` survives a manual selection.
      return {
        ...state,
        activeSubTab: action.subTab,
        selectedItemKey: action.itemKey,
      };
    case "switchSubTab":
      // Manual mode-switch updates the active sub-tab but MUST NOT push
      // history (ADR-008). Per Architecture sec 6.4 it also resets
      // `selectedItemKey` to null so the list-pane scroll lands at the top
      // of the new sub-tab AND clears `splitState` so a preview opened in
      // the previous sub-tab does not survive the mode switch (a stale-
      // split UI bug where the bottom pane would belong to a reference
      // from a different sub-tab).
      return {
        ...state,
        activeSubTab: action.subTab,
        selectedItemKey: null,
        splitState: null,
      };
    case "closeSplit": {
      // Collapse the 2-pane split (ADR-009) and push one history entry
      // (ADR-008 -- closeSplit is a cross-pane navigation action). All
      // observable fields other than `splitState` and `history` are
      // preserved. Provenance key `source` aligns with ADR-008's contract.
      const entry: NavEntry = { source: "closeSplit" };
      return {
        ...state,
        splitState: null,
        history: pushEntry(state.history, entry),
      };
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
