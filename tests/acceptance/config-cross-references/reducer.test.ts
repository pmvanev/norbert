/**
 * Acceptance tests: ConfigNavReducer (config-cross-references)
 *
 * Validates the pure reducer that owns Configuration-view-scoped navigation
 * state. Per ADR-002 and architecture.md section 6.4, the reducer is the
 * driving port for state transitions. These tests assert observable state
 * outcomes only -- no internal-implementation peeking.
 *
 * Driving port: reduce(state, action) -> state. Pure function, no React.
 *
 * Traces to:
 *   walking-skeleton.feature
 *     -- Single-click on a live reference opens a vertical split
 *     -- Single-click in an open split replaces the bottom pane only
 *     -- Single-click in the bottom pane replaces the bottom pane and preserves the top anchor
 *     -- Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update
 *     -- Ctrl+click within the same sub-tab swaps only the list selection and detail
 *     -- Ctrl+click closes any open split as part of the commit
 *     -- Ctrl+click preserves a filter that already shows the target
 *     -- Ctrl+click resets the destination filter when it would hide the target
 *     -- Single-click on a dead reference is a complete no-op
 *     -- Ctrl+click on a dead reference is a complete no-op
 *     -- Manual list-row selection does not push a history entry
 *     -- Manual sub-tab switch does not push a history entry
 *     -- Close button collapses the split back to a single pane
 *   user-stories.md US-102, US-103, US-104, US-105, US-106, US-107
 */

import { describe, expect, it } from "vitest";

import type { AggregatedConfig, ConfigSubTab } from "../../../src/plugins/norbert-config/domain/types";
import {
  buildRegistry,
  type RefType,
} from "../../../src/plugins/norbert-config/domain/references/registry";
import { resolve } from "../../../src/plugins/norbert-config/domain/references/resolver";
import {
  reduce,
  type ConfigNavState,
} from "../../../src/plugins/norbert-config/domain/nav/reducer";
import {
  initialNavState,
  liveRefTo,
  makeAgent,
  makeAggregatedConfig,
  makeCommand,
  makeHistoryWith4Entries,
  makeMcpServer,
  makePlugin,
  makeRule,
  makeWalkingSkeletonReducerArrangement,
  refTo,
} from "./_helpers/fixtures";

// @walking_skeleton @driving_port
describe("Single-click on a live reference opens a vertical split with the target previewed", () => {
  it("refSingleClick on a live reference produces a split with topRef=current and bottomRef=target", () => {
    // Arrange: a /release command is the currently-selected list item; the
    // user single-clicks an inline reference to the user-scope skill
    // `nw-bdd-requirements`.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateBefore = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
    };

    // Act: dispatch refSingleClick on the live target with the current
    // selection as the top anchor.
    const next = reduce(stateBefore, {
      tag: "refSingleClick",
      ref: targetRef,
      currentEntry: releaseEntry,
    });

    // Assert: split opens with top=current, bottom=target; list pane and
    // sub-tab unchanged; history grows by exactly one entry.
    expect(next.splitState).not.toBeNull();
    if (next.splitState === null) {
      throw new Error("splitState must be non-null after refSingleClick on a live ref");
    }
    expect(next.splitState.topRef.itemKey).toBe(releaseEntry.itemKey);
    expect(next.splitState.bottomRef.itemKey).toBe(targetRef.entry.itemKey);
    expect(next.selectedItemKey).toBe(stateBefore.selectedItemKey);
    expect(next.activeSubTab).toBe(stateBefore.activeSubTab);
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length + 1,
    );
    // ADR-009 invariant: when the split is open, selectedItemKey MUST equal
    // the top pane's itemKey (the user's spatial anchor is the open top pane,
    // and the list-pane selection must reflect that anchor). Locked in here
    // explicitly so a future refactor that decouples selectedItemKey from
    // the top anchor is caught at the example-test level rather than waiting
    // for the milestone-2 property tests to surface it.
    expect(next.selectedItemKey).toBe(next.splitState.topRef.itemKey);
  });
});

// @walking_skeleton @driving_port
describe("Single-click in an open split replaces the bottom pane only", () => {
  it("refSingleClick when splitState !== null replaces bottomRef and keeps topRef unchanged", () => {
    // Arrange: a split is already open with /release on top (A) and the
    // user-scope skill nw-bdd-requirements on the bottom (B). The user has
    // since clicked into the bottom pane so the list-pane anchor (and thus
    // the action payload's currentEntry) is now B, NOT A. The user then
    // single-clicks an inline reference to a different live target -- the
    // project-scope skill nw-discovery-methodology (C).
    //
    // Per ADR-009 the 2-slot SplitState shape forbids a third pane, so the
    // only sensible semantics is "replace the bottom pane and preserve the
    // top anchor (A)". This test is constructed so that A !== currentEntry,
    // which discriminates the bottom-replace branch from the 04-01 open-
    // from-empty branch (the latter would set the new top to currentEntry,
    // i.e. B, dropping A).
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const bRef = liveRefTo(registry, "nw-bdd-requirements");
    const cRef = liveRefTo(registry, "nw-discovery-methodology");
    const stateBefore = {
      ...initialNavState,
      selectedItemKey: bRef.entry.itemKey,
      splitState: {
        topRef: releaseEntry,
        bottomRef: bRef.entry,
        dividerRatio: 0.5,
      },
    };

    // Act: dispatch refSingleClick on C while the split is open. The
    // currentEntry payload is B (the current list-pane anchor), NOT A --
    // a correct implementation must read the top anchor from
    // state.splitState.topRef, not from action.currentEntry.
    const next = reduce(stateBefore, {
      tag: "refSingleClick",
      ref: cRef,
      currentEntry: bRef.entry,
    });

    // Assert: the top anchor (A = releaseEntry) is preserved exactly; the
    // bottom pane is replaced by C; history grows by exactly one entry.
    expect(next.splitState).not.toBeNull();
    if (next.splitState === null) {
      throw new Error("splitState must remain non-null after a bottom-replace");
    }
    expect(next.splitState.topRef).toBe(stateBefore.splitState.topRef);
    expect(next.splitState.topRef.itemKey).toBe(releaseEntry.itemKey);
    expect(next.splitState.bottomRef.itemKey).toBe(cRef.entry.itemKey);
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length + 1,
    );
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click across sub-tabs switches sub-tab, list selection, and detail in one atomic update", () => {
  it("refCtrlClick to a target in another sub-tab updates 4 fields in one returned state", () => {
    // Arrange: the user is on the 'commands' sub-tab with /release selected
    // (initialNavState.activeSubTab === 'commands'). They Ctrl+click an
    // inline reference to the user-scope skill nw-bdd-requirements (a target
    // in a DIFFERENT sub-tab -- 'skills'). Per ADR-002 / architecture sec
    // 6.7 the reducer must commit the cross-tab navigation in a single
    // returned state -- no intermediate render.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateBefore = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
    };
    // Pre-condition: this is a CROSS-tab Ctrl+click. If the target's sub-tab
    // matches the current one, the test would no longer discriminate the
    // cross-tab branch from the same-tab branch.
    expect(stateBefore.activeSubTab).not.toBe("skills");
    expect(targetRef.entry.type).toBe("skill");

    // Act: dispatch refCtrlClick on the cross-tab live target.
    const next = reduce(stateBefore, {
      tag: "refCtrlClick",
      ref: targetRef,
    });

    // Assert: all 4 fields updated atomically in one returned state.
    expect(next.activeSubTab).toBe("skills");
    expect(next.selectedItemKey).toBe(targetRef.entry.itemKey);
    expect(next.splitState).toBeNull();
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length + 1,
    );
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click within the same sub-tab swaps only the list selection and detail", () => {
  it("refCtrlClick to a target in the same sub-tab leaves activeSubTab unchanged", () => {
    // Arrange: the user is already on the 'skills' sub-tab with the user-scope
    // skill nw-bdd-requirements selected. They Ctrl+click an inline reference
    // to a DIFFERENT skill in the SAME sub-tab -- the project-scope skill
    // nw-discovery-methodology. Per ADR-002 / architecture sec 6.7 the
    // reducer must commit the same-tab navigation atomically, swapping
    // selectedItemKey while leaving activeSubTab unchanged. This scenario
    // discriminates the same-tab branch from the cross-tab branch covered by
    // 04-03; the unconditional `refTypeToSubTab` assignment from 04-03 is
    // expected to be idempotent here (assigning 'skills' when current is
    // already 'skills' produces no change), validating that the atomic
    // 4-field update naturally subsumes both branches.
    const { registry } = makeWalkingSkeletonReducerArrangement();
    const sourceRef = liveRefTo(registry, "nw-bdd-requirements");
    const targetRef = liveRefTo(registry, "nw-discovery-methodology");
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      activeSubTab: "skills",
      selectedItemKey: sourceRef.entry.itemKey,
    };
    // Pre-condition: this is a SAME-tab Ctrl+click. Both source and target
    // resolve into the 'skills' sub-tab; the test would no longer
    // discriminate the same-tab branch if the target's RefType mapped
    // elsewhere.
    expect(stateBefore.activeSubTab).toBe("skills");
    expect(targetRef.entry.type).toBe("skill");

    // Act: dispatch refCtrlClick on the same-tab live target.
    const next = reduce(stateBefore, {
      tag: "refCtrlClick",
      ref: targetRef,
    });

    // Assert: activeSubTab unchanged, selectedItemKey swapped to target,
    // splitState remains null, history grows by exactly one entry.
    expect(next.activeSubTab).toBe("skills");
    expect(next.selectedItemKey).toBe(targetRef.entry.itemKey);
    expect(next.splitState).toBeNull();
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length + 1,
    );
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click closes any open split as part of the commit", () => {
  it("refCtrlClick when splitState !== null returns splitState === null", () => {
    // Arrange: a split is already open with /release on top and the user-scope
    // skill nw-bdd-requirements on the bottom. The user then Ctrl+clicks an
    // inline reference to the project-scope hook pre-release.sh -- a target
    // in a DIFFERENT sub-tab ('hooks'). Per ADR-002 the Ctrl+click commits
    // the cross-tab navigation atomically AND closes the open split as part
    // of the same returned state -- there is no intermediate "split still
    // open" render. The split is built via refSingleClick so the arrangement
    // is constructed entirely through the driving port (no hand-rolled
    // splitState fixture peeking at internals).
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const skillRef = liveRefTo(registry, "nw-bdd-requirements");
    const hookRef = liveRefTo(registry, "pre-release.sh");
    const stateAfterSingleClick = reduce(
      {
        ...initialNavState,
        selectedItemKey: releaseEntry.itemKey,
      },
      {
        tag: "refSingleClick",
        ref: skillRef,
        currentEntry: releaseEntry,
      },
    );
    // Pre-condition: the arrangement actually has an open split. If this fails
    // the rest of the test no longer discriminates the close-split branch.
    expect(stateAfterSingleClick.splitState).not.toBeNull();

    // Act: dispatch refCtrlClick on the live hook target while the split is
    // open.
    const next = reduce(stateAfterSingleClick, {
      tag: "refCtrlClick",
      ref: hookRef,
    });

    // Assert: the split is closed AND the cross-tab navigation is committed
    // in the same returned state. activeSubTab and selectedItemKey reflect
    // the target.
    expect(next.splitState).toBeNull();
    expect(next.activeSubTab).toBe("hooks");
    expect(next.selectedItemKey).toBe(hookRef.entry.itemKey);
    expect(next.history.entries.length).toBe(
      stateAfterSingleClick.history.entries.length + 1,
    );
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click preserves a filter that already shows the target", () => {
  it("refCtrlClick with a target whose source matches the existing filter leaves the filter intact", () => {
    // Arrange: the user is on the 'commands' sub-tab and the 'skills' sub-tab
    // already has a source-filter set to 'user' (i.e. the user has narrowed
    // the skills list to user-scope items). They Ctrl+click an inline reference
    // to the user-scope skill nw-bdd-requirements -- the target's source
    // ('user') matches the destination sub-tab's existing filter source
    // ('user'), so per ADR-007 the filter must be preserved and NO
    // filterResetCue emitted (the target is already visible under the active
    // filter; resetting would be unnecessary churn and would mis-cue the user).
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = liveRefTo(registry, "nw-bdd-requirements");
    // The pre-state also carries a stale `filterResetCue` from a previous
    // navigation (the Provider has not yet acknowledged it). The matching
    // branch must replace it with `null` -- no cue is emitted for THIS
    // navigation, and any stale cue from a prior navigation is superseded by
    // this commit's outcome (per ADR-007 the cue describes the most recent
    // navigation's filter outcome, not a backlog).
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
      filter: {
        bySubTab: {
          skills: { source: "user", sort: "name" },
        },
      },
      filterResetCue: "agents",
    };
    // Pre-condition: the destination sub-tab carries an active source filter
    // that matches the target's source. Without this the test would no longer
    // discriminate the matching-preserve branch.
    expect(stateBefore.filter.bySubTab.skills?.source).toBe("user");
    expect(targetRef.entry.source).toBe("user");
    expect(targetRef.entry.type).toBe("skill");
    // Pre-condition: a stale cue is present so the assertion that the matching
    // branch sets `filterResetCue` to null is non-trivially testing the
    // reducer's commit semantics rather than the spread defaults.
    expect(stateBefore.filterResetCue).toBe("agents");

    // Act: dispatch refCtrlClick on the live cross-tab target.
    const next = reduce(stateBefore, {
      tag: "refCtrlClick",
      ref: targetRef,
    });

    // Assert: the destination sub-tab's filter is preserved verbatim and no
    // reset cue is emitted.
    expect(next.filter.bySubTab.skills?.source).toBe("user");
    expect(next.filter.bySubTab.skills?.sort).toBe("name");
    expect(next.filterResetCue).toBeNull();
    // And the rest of the cross-tab Ctrl+click commit still happens.
    expect(next.activeSubTab).toBe("skills");
    expect(next.selectedItemKey).toBe(targetRef.entry.itemKey);
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click resets the destination filter when it would hide the target", () => {
  it("refCtrlClick with a target whose source mismatches the existing filter clears the filter and emits the cue", () => {
    // Arrange: the user is on the 'commands' sub-tab with /release selected.
    // The 'skills' sub-tab carries a source-filter set to 'project' (i.e. the
    // user has narrowed the skills list to project-scope items). The 'commands'
    // sub-tab also carries an unrelated source-filter set to 'user'. The user
    // Ctrl+clicks an inline reference to the user-scope skill
    // nw-bdd-requirements -- the target's source ('user') MISMATCHES the
    // destination sub-tab's existing filter source ('project'), so per ADR-007
    // the destination sub-tab's filter must be cleared (only the `source`
    // dimension; `sort` is preserved) and a `filterResetCue` emitted naming
    // the destination sub-tab so the Provider can announce "filter cleared on
    // skills". The unrelated 'commands' sub-tab filter must remain intact --
    // ADR-007 requires the reset to be scoped to the target sub-tab only.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
      filter: {
        bySubTab: {
          skills: { source: "project", sort: "source" },
          commands: { source: "user", sort: "name" },
        },
      },
      filterResetCue: null,
    };
    // Pre-condition: the destination sub-tab carries an active source filter
    // that MISMATCHES the target's source. Without this the test would no
    // longer discriminate the mismatch-reset branch from the matching-preserve
    // branch covered in 04-06.
    expect(stateBefore.filter.bySubTab.skills?.source).toBe("project");
    expect(targetRef.entry.source).toBe("user");
    expect(targetRef.entry.type).toBe("skill");
    // Pre-condition: an unrelated sub-tab also carries a filter so the test
    // can verify the reset is scoped to only the target sub-tab.
    expect(stateBefore.filter.bySubTab.commands?.source).toBe("user");

    // Act: dispatch refCtrlClick on the live cross-tab target.
    const next = reduce(stateBefore, {
      tag: "refCtrlClick",
      ref: targetRef,
    });

    // Assert: the destination sub-tab's source filter is cleared (only the
    // source dimension; sort is preserved) and a filterResetCue is emitted
    // naming the destination sub-tab.
    expect(next.filter.bySubTab.skills?.source).toBeNull();
    expect(next.filter.bySubTab.skills?.sort).toBe("source");
    expect(next.filterResetCue).toBe("skills");
    // Other sub-tab filters are unchanged -- the reset is scoped to the
    // target sub-tab only (ADR-007).
    expect(next.filter.bySubTab.commands?.source).toBe("user");
    expect(next.filter.bySubTab.commands?.sort).toBe("name");
    // And the rest of the cross-tab Ctrl+click commit still happens.
    expect(next.activeSubTab).toBe("skills");
    expect(next.selectedItemKey).toBe(targetRef.entry.itemKey);
  });
});

// @walking_skeleton @driving_port
describe("Single-click on a dead reference is a complete no-op", () => {
  it("refSingleClick with a dead ResolvedRef returns the same state reference", () => {
    // Arrange: a non-trivial pre-state with a populated selection, an open
    // split, an active per-sub-tab filter and a stale filterResetCue, so the
    // no-op assertion is meaningful (a buggy reducer that mutates ANY of
    // these would be caught). The dead ref is constructed via the real
    // resolver against a registry that does not contain the looked-up name --
    // this is more honest about the contract than hand-rolling a
    // `{ tag: 'dead', ... }` literal because the test exercises the same
    // path the Provider would take when it dispatches a refSingleClick on a
    // detection-annotated link whose target was deleted between page-load
    // and click.
    //
    // Per ADR-008 dead refs do not push history; per ADR-009 dead refs do
    // not open splits. The 04-01 guard `if (action.ref.tag !== 'live')
    // return state;` already produces this no-op for any non-live tag, so
    // outcome (b) validation-only is expected.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const deadRef = refTo(registry, "this-name-is-not-in-the-registry");
    if (deadRef.tag !== "dead") {
      throw new Error(
        `Expected a dead ResolvedRef for an unknown name, got ${deadRef.tag}`,
      );
    }
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
      splitState: {
        topRef: releaseEntry,
        bottomRef: releaseEntry,
        dividerRatio: 0.5,
      },
      filter: {
        bySubTab: {
          skills: { source: "user", sort: "name" },
        },
      },
      filterResetCue: "agents",
    };

    // Act: dispatch refSingleClick on the dead target with a non-null
    // currentEntry (the action payload otherwise looks identical to a live
    // single-click; the only thing that should suppress state change is the
    // dead tag).
    const next = reduce(stateBefore, {
      tag: "refSingleClick",
      ref: deadRef,
      currentEntry: releaseEntry,
    });

    // Assert: every observable field is unchanged AND the returned reference
    // is the same object (no spread, no allocation -- the early-return guard
    // returns `state` verbatim per 04-01).
    expect(next).toBe(stateBefore);
    expect(next.splitState).toBe(stateBefore.splitState);
    expect(next.selectedItemKey).toBe(stateBefore.selectedItemKey);
    expect(next.activeSubTab).toBe(stateBefore.activeSubTab);
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length,
    );
    expect(next.filter).toBe(stateBefore.filter);
    expect(next.filterResetCue).toBe(stateBefore.filterResetCue);
  });
});

// @walking_skeleton @driving_port
describe("Single-click on a live reference with a null current anchor is a complete no-op", () => {
  it("refSingleClick with a live ref but currentEntry === null returns the same state reference", () => {
    // Arrange: the user is on a list-pane that has no selection
    // (selectedItemKey === null, splitState === null) and the Provider
    // dispatches refSingleClick on a LIVE ref but with currentEntry: null --
    // there is no anchor for the open-from-empty branch to use as the top
    // pane. This exercises the missing-anchor guard in handleRefSingleClick
    // where the existing 04-08 dead-ref test cannot reach (its no-op short-
    // circuits on the dead tag, never reaching the currentEntry === null
    // check). The mutation-coverage test below pins the same guard via the
    // strong "ref returned the same reference" identity assertion; this
    // walking-skeleton-level test makes the contract visible alongside the
    // other no-op scenarios so a Provider author scanning for "what does
    // refSingleClick do without a current anchor" finds the answer
    // immediately.
    //
    // Per ADR-008 no history is pushed; per ADR-009 no split is opened. The
    // guard `if (currentEntry === null) return state` is the only thing
    // standing between this dispatch and a SplitState with topRef: null --
    // a runtime-invalid state the type forbids.
    const { registry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      // No selection, no split, no current anchor.
      selectedItemKey: null,
      splitState: null,
    };

    // Act: dispatch refSingleClick on the live target with currentEntry: null.
    // The action payload otherwise looks identical to a successful open.
    const next = reduce(stateBefore, {
      tag: "refSingleClick",
      ref: targetRef,
      currentEntry: null,
    });

    // Assert: the early-return guard returns state verbatim -- same object
    // reference, no spread, no allocation. History is unchanged because no
    // entry was pushed.
    expect(next).toBe(stateBefore);
    expect(next.splitState).toBeNull();
    expect(next.history.entries.length).toBe(0);
    expect(next.history).toBe(stateBefore.history);
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click on a dead reference is a complete no-op", () => {
  it("refCtrlClick with a dead ResolvedRef returns the same state reference", () => {
    // Arrange: a non-trivial pre-state with a populated selection, an open
    // split, an active per-sub-tab filter and a stale filterResetCue, so the
    // no-op assertion is meaningful (a buggy reducer that mutates ANY of
    // these would be caught). Symmetric to the 04-08 single-click no-op:
    // the dead ref is constructed via the real resolver against a registry
    // that does not contain the looked-up name -- this is more honest about
    // the contract than hand-rolling a `{ tag: 'dead', ... }` literal because
    // the test exercises the same path the Provider would take when it
    // dispatches a refCtrlClick on a detection-annotated link whose target
    // was deleted between page-load and click.
    //
    // Per ADR-008 dead refs do not push history; per ADR-009 dead refs do
    // not open splits. The handleRefCtrlClick guard
    // `if (ref.tag !== 'live') return state;` already produces this no-op
    // for any non-live tag, so outcome (b) validation-only is expected.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const deadRef = refTo(registry, "this-name-is-not-in-the-registry");
    if (deadRef.tag !== "dead") {
      throw new Error(
        `Expected a dead ResolvedRef for an unknown name, got ${deadRef.tag}`,
      );
    }
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
      splitState: {
        topRef: releaseEntry,
        bottomRef: releaseEntry,
        dividerRatio: 0.5,
      },
      filter: {
        bySubTab: {
          skills: { source: "user", sort: "name" },
        },
      },
      filterResetCue: "agents",
    };

    // Act: dispatch refCtrlClick on the dead target. The action payload
    // otherwise looks identical to a live Ctrl+click; the only thing that
    // should suppress state change is the dead tag.
    const next = reduce(stateBefore, {
      tag: "refCtrlClick",
      ref: deadRef,
    });

    // Assert: every observable field is unchanged AND the returned reference
    // is the same object (no spread, no allocation -- the early-return guard
    // returns `state` verbatim).
    expect(next).toBe(stateBefore);
    expect(next.splitState).toBe(stateBefore.splitState);
    expect(next.selectedItemKey).toBe(stateBefore.selectedItemKey);
    expect(next.activeSubTab).toBe(stateBefore.activeSubTab);
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length,
    );
    expect(next.filter).toBe(stateBefore.filter);
    expect(next.filterResetCue).toBe(stateBefore.filterResetCue);
  });
});

// @walking_skeleton @driving_port
describe("Manual list-row selection does not push a history entry", () => {
  it("selectItem leaves history.entries.length unchanged (ADR-008)", () => {
    // Arrange: a non-trivial pre-state where the user is on the 'commands'
    // sub-tab with /release selected, and a populated 4-entry history (a
    // realistic mid-session backlog from prior cross-ref clicks). Per ADR-008
    // only cross-ref actions (refSingleClick, refCtrlClick, closeSplit) push
    // history entries; manual list-row selection MUST NOT push, even though
    // it updates the focused item. The pre-state's mid-history `headIndex`
    // (== 1) lets us also confirm the reducer does not silently truncate the
    // forward branch the way a navigation push would.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetSkill = liveRefTo(registry, "nw-bdd-requirements");
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      activeSubTab: "commands",
      selectedItemKey: releaseEntry.itemKey,
      history: makeHistoryWith4Entries(1),
    };
    // Pre-condition: the target item is in a different sub-tab from the
    // current activeSubTab so the action carries a non-trivial subTab change
    // alongside the itemKey change. If they matched, the test would no longer
    // discriminate the optional-subTab branch of selectItem.
    expect(stateBefore.activeSubTab).not.toBe("skills");

    // Act: dispatch selectItem on the cross-tab target. This is a MANUAL
    // selection (e.g. the user clicked a list row in the 'skills' sub-tab),
    // not a cross-ref navigation.
    const next = reduce(stateBefore, {
      tag: "selectItem",
      subTab: "skills",
      itemKey: targetSkill.entry.itemKey,
    });

    // Assert: selectedItemKey and activeSubTab updated; history is unchanged
    // (same entries array, same headIndex) -- ADR-008 manual-selection rule.
    expect(next.selectedItemKey).toBe(targetSkill.entry.itemKey);
    expect(next.activeSubTab).toBe("skills");
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length,
    );
    expect(next.history).toBe(stateBefore.history);
  });
});

// @walking_skeleton @driving_port
describe("Manual sub-tab switch does not push a history entry", () => {
  it("switchSubTab leaves history.entries.length unchanged (ADR-008)", () => {
    // Arrange: a non-trivial pre-state where the user is on the 'commands'
    // sub-tab with /release selected, and a populated 4-entry history (a
    // realistic mid-session backlog from prior cross-ref clicks). Per ADR-008
    // only cross-ref actions (refSingleClick, refCtrlClick, closeSplit) push
    // history entries; a manual sub-tab switch MUST NOT push, even though it
    // changes the active sub-tab. Per Architecture sec 6.4 the mode-switch
    // also resets `selectedItemKey` to null so the list-pane scroll lands at
    // the top of the new sub-tab. The pre-state's mid-history `headIndex`
    // (== 1) lets us also confirm the reducer does not silently truncate the
    // forward branch the way a navigation push would.
    const { releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      activeSubTab: "commands",
      selectedItemKey: releaseEntry.itemKey,
      history: makeHistoryWith4Entries(1),
    };
    // Pre-condition: the target sub-tab differs from the current activeSubTab
    // so the action drives a real mode-switch (not a no-op). Without this
    // the test would no longer discriminate the switch from a degenerate
    // identity case.
    expect(stateBefore.activeSubTab).not.toBe("skills");
    // Pre-condition: a current selection exists so the mode-switch reset to
    // null is non-trivially testing the reducer (a buggy implementation that
    // forgot to clear selectedItemKey would still pass if it started as null).
    expect(stateBefore.selectedItemKey).not.toBeNull();

    // Act: dispatch switchSubTab to a different sub-tab. This is a MANUAL
    // mode switch (e.g. the user clicked the 'skills' sub-tab header), not a
    // cross-ref navigation.
    const next = reduce(stateBefore, {
      tag: "switchSubTab",
      subTab: "skills",
    });

    // Assert: activeSubTab updated; selectedItemKey reset to null
    // (mode-switch reset per Architecture sec 6.4); history is unchanged
    // (same entries array, same headIndex) -- ADR-008 manual-switch rule.
    expect(next.activeSubTab).toBe("skills");
    expect(next.selectedItemKey).toBeNull();
    expect(next.history.entries.length).toBe(
      stateBefore.history.entries.length,
    );
    expect(next.history).toBe(stateBefore.history);
  });
});

// @walking_skeleton @driving_port
describe("Manual sub-tab switch clears any open split", () => {
  it("switchSubTab returns splitState === null when a split was open before the switch", () => {
    // Arrange: a split is already open (built through the driving port via
    // refSingleClick so the arrangement is not hand-rolling internals). Per
    // architecture sec 6.4 a manual sub-tab switch resets THREE fields:
    // activeSubTab (to the new tab), selectedItemKey (to null), and
    // splitState (to null). The selectedItemKey reset is already covered by
    // the existing 04-11 test; this scenario discriminates the splitState
    // reset, which a buggy reducer that only spread state and overrode
    // activeSubTab/selectedItemKey would silently leak past -- leaving a
    // stale-split UI bug where the bottom preview pane belongs to a
    // reference from a different sub-tab.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const skillRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateAfterSingleClick = reduce(
      {
        ...initialNavState,
        selectedItemKey: releaseEntry.itemKey,
      },
      {
        tag: "refSingleClick",
        ref: skillRef,
        currentEntry: releaseEntry,
      },
    );
    // Pre-condition: the arrangement actually has an open split. If this
    // fails the rest of the test no longer discriminates the split-clear
    // branch from the existing selectedItemKey-reset branch.
    expect(stateAfterSingleClick.splitState).not.toBeNull();
    // Pre-condition: the target sub-tab differs from the current activeSubTab
    // so the action drives a real mode-switch (not a no-op).
    expect(stateAfterSingleClick.activeSubTab).not.toBe("hooks");

    // Act: dispatch switchSubTab to a different sub-tab while the split is
    // open. Per architecture sec 6.4 this MUST clear the split as part of
    // the same returned state.
    const next = reduce(stateAfterSingleClick, {
      tag: "switchSubTab",
      subTab: "hooks",
    });

    // Assert: splitState is cleared, activeSubTab updated, selectedItemKey
    // reset to null (existing sec 6.4 contract), history is unchanged
    // (ADR-008 manual-switch rule).
    expect(next.splitState).toBeNull();
    expect(next.activeSubTab).toBe("hooks");
    expect(next.selectedItemKey).toBeNull();
    expect(next.history).toBe(stateAfterSingleClick.history);
  });
});

// @walking_skeleton @driving_port
describe("Close button collapses the split back to a single pane", () => {
  it("closeSplit returns splitState === null and pushes one history entry", () => {
    // Arrange: a split is already open with /release on top and the user-scope
    // skill nw-bdd-requirements on the bottom. The arrangement is constructed
    // entirely through the driving port (refSingleClick) so we are not
    // hand-rolling a splitState fixture that peeks at internals -- the closeSplit
    // contract is exercised against state produced by the very same reducer.
    // Per ADR-008 closeSplit is a cross-pane navigation action and pushes a
    // history entry; per ADR-009 it collapses the 2-pane split back to a single
    // pane by setting splitState to null.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const skillRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateAfterSingleClick = reduce(
      {
        ...initialNavState,
        selectedItemKey: releaseEntry.itemKey,
      },
      {
        tag: "refSingleClick",
        ref: skillRef,
        currentEntry: releaseEntry,
      },
    );
    // Pre-condition: the arrangement actually has an open split. If this fails
    // the rest of the test no longer discriminates the close-split branch.
    expect(stateAfterSingleClick.splitState).not.toBeNull();

    // Act: dispatch closeSplit while the split is open.
    const next = reduce(stateAfterSingleClick, { tag: "closeSplit" });

    // Assert: the split is collapsed and a history entry is pushed. Other
    // observable fields (activeSubTab, selectedItemKey, filter) are unchanged.
    expect(next.splitState).toBeNull();
    expect(next.history.entries.length).toBe(
      stateAfterSingleClick.history.entries.length + 1,
    );
    expect(next.activeSubTab).toBe(stateAfterSingleClick.activeSubTab);
    expect(next.selectedItemKey).toBe(stateAfterSingleClick.selectedItemKey);
    expect(next.filter).toBe(stateAfterSingleClick.filter);
  });
});

// @mutation-coverage @driving_port
describe("Cross-reference history entries record the originating action and target itemKey", () => {
  it("refSingleClick (open-from-empty), refSingleClick (bottom-replace), refCtrlClick, and closeSplit each push an entry whose action and targetItemKey match the dispatched intent", () => {
    // Pins the NavEntry shape pushed by every cross-ref action in the reducer.
    // The original walking-skeleton tests only assert `history.entries.length`
    // grew by 1; they never inspect the entry payload. Per ADR-006/ADR-008 the
    // entry IS the audit record that drives the live-cue announcer (US-104),
    // so the action discriminator and targetItemKey must be exact -- not just
    // "an entry was pushed". Mutating any of the four call sites in the
    // reducer (refSingleClick open, refSingleClick replace, refCtrlClick,
    // closeSplit) to drop the action string or omit targetItemKey is a real
    // bug the announcer would surface as silent or mislabelled cues.
    //
    // One scenario covers all four pushers because they share a single
    // makeRefClickEntry helper (plus the closeSplit literal); reading the
    // tail entry of each post-state is a tight, readable assertion.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const skillRef = refTo(registry, "nw-bdd-requirements");
    if (skillRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${skillRef.tag}`,
      );
    }
    const otherSkillRef = refTo(registry, "nw-discovery-methodology");
    if (otherSkillRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-discovery-methodology, got ${otherSkillRef.tag}`,
      );
    }
    const hookRef = refTo(registry, "pre-release.sh");
    if (hookRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for pre-release.sh, got ${hookRef.tag}`,
      );
    }

    // Step 1: refSingleClick on empty split (open-from-empty branch).
    // Provenance key is `source` per ADR-008.
    const afterOpen = reduce(
      { ...initialNavState, selectedItemKey: releaseEntry.itemKey },
      { tag: "refSingleClick", ref: skillRef, currentEntry: releaseEntry },
    );
    const openEntry = afterOpen.history.entries[afterOpen.history.entries.length - 1];
    expect(openEntry).toBeDefined();
    expect(openEntry?.source).toBe("refSingleClick");
    expect(openEntry?.targetItemKey).toBe(skillRef.entry.itemKey);

    // Step 2: refSingleClick on a non-null split (bottom-replace branch).
    const afterReplace = reduce(afterOpen, {
      tag: "refSingleClick",
      ref: otherSkillRef,
      currentEntry: skillRef.entry,
    });
    const replaceEntry =
      afterReplace.history.entries[afterReplace.history.entries.length - 1];
    expect(replaceEntry).toBeDefined();
    expect(replaceEntry?.source).toBe("refSingleClick");
    expect(replaceEntry?.targetItemKey).toBe(otherSkillRef.entry.itemKey);

    // Step 3: refCtrlClick (cross-tab branch -- pre-state has an open split so
    // we also pin the entry pushed when the reducer commits an atomic
    // 4-field update + close).
    const afterCtrl = reduce(afterReplace, {
      tag: "refCtrlClick",
      ref: hookRef,
    });
    const ctrlEntry = afterCtrl.history.entries[afterCtrl.history.entries.length - 1];
    expect(ctrlEntry).toBeDefined();
    expect(ctrlEntry?.source).toBe("refCtrlClick");
    expect(ctrlEntry?.targetItemKey).toBe(hookRef.entry.itemKey);

    // Step 4: closeSplit -- pushes an entry whose source discriminator is the
    // literal "closeSplit". closeSplit entries do NOT carry a targetItemKey
    // (the action has no target), so we pin only the source discriminator.
    // First reopen a split so closeSplit is non-degenerate.
    const reopened = reduce(
      { ...initialNavState, selectedItemKey: releaseEntry.itemKey },
      { tag: "refSingleClick", ref: skillRef, currentEntry: releaseEntry },
    );
    const afterClose = reduce(reopened, { tag: "closeSplit" });
    const closeEntry = afterClose.history.entries[afterClose.history.entries.length - 1];
    expect(closeEntry).toBeDefined();
    expect(closeEntry?.source).toBe("closeSplit");
  });
});

// @mutation-coverage @driving_port
describe("Ctrl+click into a destination sub-tab with no active filter preserves state and emits no cue", () => {
  it("refCtrlClick on a cross-tab live target whose destination sub-tab has no entry in filter.bySubTab returns the same filter reference and a null cue", () => {
    // Pins resolveFilterOnNav Rule 1 (destination has no filter at all).
    // The 04-06 "preserves" test exercises Rule 2 (destination has a matching
    // filter); the 04-07 "resets" test exercises Rule 3 (destination has a
    // mismatching filter). Neither exercises Rule 1 -- the destination
    // having no filter entry at all. Mutating the Rule 1 short-circuit
    // (`existing === undefined || existing.source === null` -> false) would
    // cause the reducer to fall through to the mismatch branch and spuriously
    // emit a cue for a navigation that should be a quiet preserve.
    //
    // Setup: an unrelated sub-tab carries a filter so filter.bySubTab is
    // non-empty (a buggy implementation that always returned `prevFilter`
    // without inspecting `existing` could pass with an empty bySubTab).
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = refTo(registry, "nw-bdd-requirements");
    if (targetRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${targetRef.tag}`,
      );
    }
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
      filter: {
        bySubTab: {
          // Unrelated sub-tab filter -- destination 'skills' has no entry.
          commands: { source: "user", sort: "name" },
        },
      },
      filterResetCue: null,
    };
    // Pre-condition: destination sub-tab has NO filter entry.
    expect(stateBefore.filter.bySubTab.skills).toBeUndefined();

    const next = reduce(stateBefore, { tag: "refCtrlClick", ref: targetRef });

    // Filter object is preserved by reference (Rule 1 returns prevFilter as-is)
    // and no cue is emitted. The unrelated 'commands' filter survives intact.
    expect(next.filter).toBe(stateBefore.filter);
    expect(next.filterResetCue).toBeNull();
    expect(next.filter.bySubTab.commands?.source).toBe("user");
    // The cross-tab navigation still commits.
    expect(next.activeSubTab).toBe("skills");
    expect(next.selectedItemKey).toBe(targetRef.entry.itemKey);
  });
});

// @mutation-coverage @driving_port
describe("Ctrl+click into a destination sub-tab whose existing filter has source=null preserves state and emits no cue", () => {
  it("refCtrlClick on a cross-tab live target whose destination filter exists with source === null returns the same filter reference and a null cue", () => {
    // Pins the right-hand operand of the resolveFilterOnNav Rule 1
    // disjunction (`existing === undefined || existing.source === null`).
    // The 04-06 "preserves" test exercises Rule 2 (non-null source matching
    // target). The 04-07 "resets" test exercises Rule 3 (non-null source
    // mismatching target). The "no active filter" mutation-coverage test
    // above exercises the LEFT operand (existing === undefined). What none of
    // them exercise is the RIGHT operand: an entry exists in bySubTab BUT
    // its source is null (e.g. the user previously cleared the source filter
    // explicitly while keeping a non-default sort). Per ADR-007 a null source
    // is "no source filter" and must short-circuit the same way an absent
    // entry does -- preserve and emit no cue. Mutating the right operand to
    // `false` would fall through to the source-equality check and, because
    // the target source is non-null, drop into Rule 3 -- spuriously
    // re-clearing an already-null source AND emitting a misleading cue.
    const { registry, releaseEntry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = liveRefTo(registry, "nw-bdd-requirements");
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      selectedItemKey: releaseEntry.itemKey,
      filter: {
        bySubTab: {
          // Destination sub-tab carries a filter entry but its source is null;
          // a non-default sort is preserved so the entry is non-trivial.
          skills: { source: null, sort: "source" },
        },
      },
      filterResetCue: null,
    };
    // Pre-conditions discriminate the right operand of the Rule 1
    // disjunction: the entry exists, its source is null, and the target's
    // source is non-null.
    expect(stateBefore.filter.bySubTab.skills).toBeDefined();
    expect(stateBefore.filter.bySubTab.skills?.source).toBeNull();
    expect(targetRef.entry.source).toBe("user");

    const next = reduce(stateBefore, { tag: "refCtrlClick", ref: targetRef });

    // The Rule 1 short-circuit returns prevFilter as-is (same object
    // reference) and emits no cue. The user-set sort is preserved.
    expect(next.filter).toBe(stateBefore.filter);
    expect(next.filterResetCue).toBeNull();
    expect(next.filter.bySubTab.skills?.source).toBeNull();
    expect(next.filter.bySubTab.skills?.sort).toBe("source");
  });
});

// @mutation-coverage @driving_port
describe("Single-click on a live reference with no current anchor is a complete no-op", () => {
  it("refSingleClick when splitState === null and currentEntry === null returns the same state reference", () => {
    // Pins the missing-anchor guard in handleRefSingleClick. The 04-01 open-
    // from-empty test always supplies a non-null currentEntry, so the
    // `if (currentEntry === null) return state` guard is never exercised.
    // Mutating it to `if (false)` would cause the reducer to fall through and
    // build a SplitState with `topRef: null` -- a runtime-invalid state the
    // ADR-009 type forbids. The guard is the only thing standing between a
    // detection-annotated link click on a list-pane that has no current
    // selection and a corrupted split.
    //
    // The action payload otherwise looks identical to a successful open --
    // only currentEntry being null should suppress the state change.
    const { registry } = makeWalkingSkeletonReducerArrangement();
    const targetRef = refTo(registry, "nw-bdd-requirements");
    if (targetRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${targetRef.tag}`,
      );
    }
    const stateBefore: ConfigNavState = {
      ...initialNavState,
      // No selection, no split, no current anchor.
      selectedItemKey: null,
      splitState: null,
    };

    const next = reduce(stateBefore, {
      tag: "refSingleClick",
      ref: targetRef,
      currentEntry: null,
    });

    // The early-return guard returns state verbatim -- same object reference,
    // no spread, no allocation. History is unchanged because no entry was
    // pushed.
    expect(next).toBe(stateBefore);
    expect(next.splitState).toBeNull();
    expect(next.history).toBe(stateBefore.history);
    expect(next.history.entries.length).toBe(stateBefore.history.entries.length);
  });
});

// @mutation-coverage @driving_port
describe("Cross-tab Ctrl+click maps each RefType to its canonical Configuration sub-tab", () => {
  // Pins the REF_TYPE_TO_SUB_TAB mapping. The walking-skeleton tests cover
  // skill -> 'skills' and hook -> 'hooks'; the remaining five RefType
  // entries (agent, command, mcp, rule, plugin) are unexercised, so any
  // string-literal mutation on those map values survives. The mapping is the
  // pure pivot the reducer uses to dispatch a cross-ref click into the right
  // Configuration view sub-tab; mismapping any entry would silently land the
  // user on the wrong sub-tab. Each scenario builds a single-item
  // AggregatedConfig that carries exactly one item of the targeted RefType,
  // resolves it through the registry, and asserts the post-state's
  // activeSubTab.
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly name: string;
    readonly config: AggregatedConfig;
    readonly expectedSubTab: ConfigSubTab;
    readonly expectedRefType: RefType;
  }> = [
    {
      label: "agent -> 'agents'",
      name: "release-agent",
      config: makeAggregatedConfig({ agents: [makeAgent("release-agent", "user")] }),
      expectedSubTab: "agents",
      expectedRefType: "agent",
    },
    {
      label: "command -> 'commands'",
      name: "deploy",
      config: makeAggregatedConfig({ commands: [makeCommand("deploy", "user")] }),
      expectedSubTab: "commands",
      expectedRefType: "command",
    },
    {
      label: "mcp -> 'mcp'",
      name: "playwright",
      config: makeAggregatedConfig({ mcpServers: [makeMcpServer("playwright", "user")] }),
      expectedSubTab: "mcp",
      expectedRefType: "mcp",
    },
    {
      // Rule entries have no name field; the registry indexes them by the
      // basename of their filePath (registry.entryFromRule). makeRule defaults
      // to `.claude/CLAUDE.md` so the lookup name is "CLAUDE.md".
      label: "rule -> 'rules'",
      name: "CLAUDE.md",
      config: makeAggregatedConfig({ rules: [makeRule("no-secrets", "project")] }),
      expectedSubTab: "rules",
      expectedRefType: "rule",
    },
    {
      label: "plugin -> 'plugins'",
      name: "norbert-config",
      config: makeAggregatedConfig({ plugins: [makePlugin("norbert-config")] }),
      expectedSubTab: "plugins",
      expectedRefType: "plugin",
    },
  ];

  it.each(cases)(
    "refCtrlClick on a live $label sets activeSubTab to the canonical sub-tab id",
    ({ name, config, expectedSubTab, expectedRefType }) => {
      const registry = buildRegistry(config, 0);
      const targetRef = resolve({ kind: "name", value: name }, registry);
      if (targetRef.tag !== "live") {
        throw new Error(
          `Fixture must yield a live ref for '${name}', got ${targetRef.tag}`,
        );
      }
      // Pre-condition: the registry entry is the targeted RefType so the
      // mapping under test is the one being exercised (not an accidental
      // alias).
      expect(targetRef.entry.type).toBe(expectedRefType);

      const next = reduce(initialNavState, {
        tag: "refCtrlClick",
        ref: targetRef,
      });

      // Asserts the literal sub-tab id the mapping must produce. A mutation
      // that replaces any value with "" would set activeSubTab to "" here
      // and fail.
      expect(next.activeSubTab).toBe(expectedSubTab);
      expect(next.selectedItemKey).toBe(targetRef.entry.itemKey);
    },
  );
});

// @milestone-2 @driving_port @property
describe("For any sequence of single-clicks on live references the split is always exactly 2 panes", () => {
  it.skip("property: splitState is either null OR has both topRef and bottomRef present after any refSingleClick sequence", () => {
    // Note (per ADR-009 + SA-LOW reframe): a third pane is a COMPILE-TIME
    // error in TypeScript -- SplitState is a fixed-shape record with exactly
    // topRef and bottomRef. This runtime property test does NOT assert a pane
    // count; it asserts the *logical* invariant that the split either is
    // closed (null) or has BOTH expected refs populated. The structural
    // shape is enforced by the type system.
    //
    // fc.assert(fc.property(fc.array(refSingleClickArb), (actions) => {
    //   const final = actions.reduce(reduce, initialSplitState);
    //   return (
    //     final.splitState === null ||
    //     (final.splitState.topRef !== undefined &&
    //      final.splitState.bottomRef !== undefined)
    //   );
    // }));
  });
});

// @milestone-2 @driving_port
describe("When the split is open the selected list item key always equals the top pane reference key", () => {
  it.skip("property: state.splitState !== null implies state.selectedItemKey === state.splitState.topRef.itemKey", () => {
    // Verified across all reachable states by exhaustive action enumeration
    // OR by fast-check on action sequences.
  });
});
