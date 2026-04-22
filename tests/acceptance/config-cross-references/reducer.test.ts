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

import {
  reduce,
  type ConfigNavState,
} from "../../../src/plugins/norbert-config/domain/nav/reducer";
import {
  initialNavState,
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
    const targetRef = refTo(registry, "nw-bdd-requirements");
    if (targetRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${targetRef.tag}`,
      );
    }
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
    const bRef = refTo(registry, "nw-bdd-requirements");
    if (bRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${bRef.tag}`,
      );
    }
    const cRef = refTo(registry, "nw-discovery-methodology");
    if (cRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-discovery-methodology, got ${cRef.tag}`,
      );
    }
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
    const targetRef = refTo(registry, "nw-bdd-requirements");
    if (targetRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${targetRef.tag}`,
      );
    }
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
    const sourceRef = refTo(registry, "nw-bdd-requirements");
    if (sourceRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-bdd-requirements, got ${sourceRef.tag}`,
      );
    }
    const targetRef = refTo(registry, "nw-discovery-methodology");
    if (targetRef.tag !== "live") {
      throw new Error(
        `walkingSkeletonConfig must yield a live ref for nw-discovery-methodology, got ${targetRef.tag}`,
      );
    }
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
  it.skip("refCtrlClick when splitState !== null returns splitState === null", () => {
    // Given: state.splitState = { topRef: '/release', bottomRef: 'nw-bdd-requirements' }
    // When:  next = reduce(state, { tag: 'refCtrlClick', ref: refTo(hook 'pre-release.sh') })
    // Then:  next.splitState === null
    //        next.activeSubTab === 'hooks'
    //        next.selectedItemKey === 'pre-release.sh'
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click preserves a filter that already shows the target", () => {
  it.skip("refCtrlClick with a target whose source matches the existing filter leaves the filter intact", () => {
    // Given: state.filter.bySubTab.skills.source === 'user'
    // When:  next = reduce(state, { tag: 'refCtrlClick', ref: refTo(user-scope skill) })
    // Then:  next.filter.bySubTab.skills.source === 'user'
    //        no filterResetCue is set
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click resets the destination filter when it would hide the target", () => {
  it.skip("refCtrlClick with a target whose source mismatches the existing filter clears the filter and emits the cue", () => {
    // Given: state.filter.bySubTab.skills.source === 'project'
    // When:  next = reduce(state, { tag: 'refCtrlClick', ref: refTo(user-scope skill) })
    // Then:  next.filter.bySubTab.skills.source === null
    //        next.filterResetCue === 'skills'  (per ADR-007)
  });
});

// @walking_skeleton @driving_port
describe("Single-click on a dead reference is a complete no-op", () => {
  it.skip("refSingleClick with a dead ResolvedRef returns the same state reference", () => {
    // Given: any state
    // When:  next = reduce(state, { tag: 'refSingleClick', ref: deadResolvedRef })
    // Then:  next === state  (or deep-equal with no history change)
    //        next.history.entries.length === state.history.entries.length
  });
});

// @walking_skeleton @driving_port
describe("Ctrl+click on a dead reference is a complete no-op", () => {
  it.skip("refCtrlClick with a dead ResolvedRef returns the same state reference", () => {
    // Given: any state
    // When:  next = reduce(state, { tag: 'refCtrlClick', ref: deadResolvedRef })
    // Then:  next.activeSubTab === state.activeSubTab
    //        next.selectedItemKey === state.selectedItemKey
    //        next.splitState === state.splitState
    //        next.history.entries.length === state.history.entries.length
  });
});

// @walking_skeleton @driving_port
describe("Manual list-row selection does not push a history entry", () => {
  it.skip("selectItem leaves history.entries.length unchanged (ADR-008)", () => {
    // When:  next = reduce(state, { tag: 'selectItem', subTab, itemKey, item })
    // Then:  next.history.entries.length === state.history.entries.length
  });
});

// @walking_skeleton @driving_port
describe("Manual sub-tab switch does not push a history entry", () => {
  it.skip("switchSubTab leaves history.entries.length unchanged (ADR-008)", () => {
    // When:  next = reduce(state, { tag: 'switchSubTab', subTab })
    // Then:  next.history.entries.length === state.history.entries.length
    //        next.selectedItemKey === null  (mode-switch resets selection)
  });
});

// @walking_skeleton @driving_port
describe("Close button collapses the split back to a single pane", () => {
  it.skip("closeSplit returns splitState === null and pushes one history entry", () => {
    // Given: state.splitState !== null
    // When:  next = reduce(state, { tag: 'closeSplit' })
    // Then:  next.splitState === null
    //        next.history.entries.length === state.history.entries.length + 1
  });
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
