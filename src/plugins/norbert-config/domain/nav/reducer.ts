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
import type { RefType, RegistryEntry } from "../references/registry";
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
 *   3. (Step 04-07) Mismatch                      -> reset only the target
 *                                                    sub-tab's filter, emit cue.
 *
 * The cue (`resetCue`) is always either `null` (no announcement) or the
 * destination sub-tab id (Provider announces "filter cleared on <tab>" then
 * dispatches an acknowledge action that sets it back to null).
 *
 * Step 04-06 implements rules 1 and 2 only. Rule 3 lands in 04-07; the helper
 * shape is fixed now so 04-07 is a single internal edit.
 */
function resolveFilterOnNav(
  prevFilter: ConfigNavState["filter"],
  targetSubTab: ConfigSubTab,
  _targetSource: string,
): { readonly filter: ConfigNavState["filter"]; readonly resetCue: ConfigSubTab | null } {
  const existing = prevFilter.bySubTab[targetSubTab];
  if (existing === undefined || existing.source === null) {
    // Rule 1: no filter to preserve or reset.
    return { filter: prevFilter, resetCue: null };
  }
  if (existing.source === _targetSource) {
    // Rule 2: filter already shows the target -- preserve verbatim.
    return { filter: prevFilter, resetCue: null };
  }
  // Rule 3 (04-07): mismatch -- clear only the target sub-tab's `source`
  // filter dimension (preserving `sort`) and emit the reset cue naming the
  // destination sub-tab. The reset is scoped to the target sub-tab only --
  // other sub-tab entries in `bySubTab` are spread through unchanged so
  // unrelated filters (e.g. on the source sub-tab) survive the cross-reference
  // navigation. ADR-007 specifies the cue is the destination sub-tab id; the
  // Provider reads it, announces "filter cleared on <tab>", then dispatches
  // an acknowledge action that sets it back to null (deferred -- not in
  // walking-skeleton scope).
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
 *                          as part of the commit; refined by 04-05)
 *   - `history`          : exactly one entry pushed (ADR-008)
 *   - `filter`           : preserved or reset per {@link resolveFilterOnNav}
 *                          (ADR-007 -- step 04-06 covers the matching branch)
 *   - `filterResetCue`   : null or the destination sub-tab id, per the same
 *                          helper. Always overwritten -- the cue describes
 *                          THIS navigation's outcome, never a prior backlog.
 *
 * Dead/ambiguous/unsupported branches are no-ops in the walking-skeleton
 * scope; later steps (04-07, 04-08) refine them.
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
 *   1. `state.splitState === null` (Step 04-01 -- open-from-empty):
 *      a non-null `currentEntry` becomes the new top, the target becomes
 *      the bottom, and a history entry is pushed.
 *
 *   2. `state.splitState !== null` (Step 04-02 -- bottom-replace):
 *      the existing `topRef` is preserved as the top anchor (the action's
 *      `currentEntry` is intentionally ignored here -- the user's spatial
 *      anchor is the open top pane, not the list selection), the target
 *      becomes the new bottom, `dividerRatio` is preserved, and a history
 *      entry is pushed. This preserves the user's mental model: the top
 *      pane stays put while successive single-clicks scan through bottoms.
 *
 * Dead/ambiguous/unsupported branches and missing-anchor handling land in
 * 04-03..04-09 and currently fall through to a state-unchanged return.
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
      return handleRefCtrlClick(state, action.ref);
    case "selectItem":
      // Manual list-row selection. Per ADR-008 only cross-ref actions push
      // history entries -- selectItem updates the focused item (and possibly
      // the active sub-tab when the action carries one) but MUST NOT push.
      // The history field is left untouched so a mid-history `headIndex`
      // survives a manual selection (no silent forward-branch truncation).
      return {
        ...state,
        activeSubTab: action.subTab,
        selectedItemKey: action.itemKey,
      };
    case "switchSubTab":
    case "closeSplit":
      // Walking-skeleton placeholder: implementations land in 04-11..04-12.
      return state;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
