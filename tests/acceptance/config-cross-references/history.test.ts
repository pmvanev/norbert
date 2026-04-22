/**
 * Acceptance tests: NavHistory LRU stack (config-cross-references)
 *
 * Validates the pure NavHistory module per ADR-006: LRU 50, head index
 * invariants, forward-stack clearing on new push.
 *
 * Driving port: pushEntry(history, entry), goBack(history), goForward(history),
 *               canGoBack(history), canGoForward(history). Pure functions.
 *
 * Traces to:
 *   walking-skeleton.feature
 *     -- Alt+Left restores the previous navigation snapshot
 *     -- Alt+Right re-advances after going back
 *     -- A new cross-reference action after Alt+Left clears the forward stack
 *     -- Alt+Left at the start of history is a no-op with end-of-history cue
 *     -- For any sequence of navigation actions the history never exceeds 50 entries
 *   user-stories.md US-104 acceptance criteria
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  canGoBack,
  canGoForward,
  goBack,
  goForward,
  pushEntry,
  MAX_HISTORY_ENTRIES,
  type NavEntry,
  type NavHistory,
} from "../../../src/plugins/norbert-config/domain/nav/history";
import { emptyHistory, makeFiftyEntries, makeHistoryWith4Entries } from "./_helpers/fixtures";

// @walking_skeleton @driving_port
describe("Alt+Left restores the previous navigation snapshot", () => {
  it("goBack on a 4-entry history with headIndex=3 returns headIndex=2", () => {
    const h = makeHistoryWith4Entries(3);
    const next = goBack(h);
    expect(next.headIndex).toBe(2);
    expect(next.entries).toEqual(h.entries); // entries themselves unchanged
  });
});

// @walking_skeleton @driving_port
describe("Alt+Right re-advances after going back", () => {
  it("goForward on a 4-entry history with headIndex=2 returns headIndex=3", () => {
    const h = makeHistoryWith4Entries(2);
    const next = goForward(h);
    expect(next.headIndex).toBe(3);
    expect(next.entries).toEqual(h.entries); // entries themselves unchanged
  });
});

// @walking_skeleton @driving_port
describe("A new cross-reference action after Alt+Left clears the forward stack", () => {
  it("pushEntry on a history with headIndex < entries.length-1 truncates the tail before pushing", () => {
    const h = makeHistoryWith4Entries(2);
    const e4 = { k: "e4" };
    const next = pushEntry(h, e4);
    expect(next.entries).toEqual([{ k: "e0" }, { k: "e1" }, { k: "e2" }, { k: "e4" }]);
    expect(next.headIndex).toBe(3);
  });
});

// @walking_skeleton @driving_port
describe("Alt+Left at the start of history is a no-op with end-of-history cue", () => {
  it("goBack on a history with headIndex=0 returns the same history", () => {
    const h = { entries: [{ k: "e0" }, { k: "e1" }] as const, headIndex: 0 };
    const next = goBack(h);
    expect(next).toEqual(h);
    expect(canGoBack(h)).toBe(false);
  });
});

// @walking_skeleton @driving_port
describe("Alt+Right at end of history is a no-op", () => {
  it("goForward on a history with headIndex=entries.length-1 returns the same history", () => {
    const h = { entries: [{ k: "e0" }, { k: "e1" }] as const, headIndex: 1 };
    const next = goForward(h);
    expect(next).toEqual(h);
    expect(canGoForward(h)).toBe(false);
    // Regression-guard for the happy case: canGoForward is true mid-stack.
    const h0 = { entries: [{ k: "e0" }, { k: "e1" }] as const, headIndex: 0 };
    expect(canGoForward(h0)).toBe(true);
  });
});

// @walking_skeleton @driving_port @property
describe("For any sequence of navigation actions the history never exceeds 50 entries", () => {
  it("property: |entries| <= 50 and 0 <= headIndex < |entries| after any sequence of pushEntry/goBack/goForward", () => {
    type Action =
      | { readonly type: "push"; readonly entry: NavEntry }
      | { readonly type: "back" }
      | { readonly type: "forward" };

    const pushArb: fc.Arbitrary<Action> = fc.record({
      type: fc.constant("push" as const),
      entry: fc.record({ k: fc.string() }),
    });
    const backArb: fc.Arbitrary<Action> = fc.record({
      type: fc.constant("back" as const),
    });
    const forwardArb: fc.Arbitrary<Action> = fc.record({
      type: fc.constant("forward" as const),
    });
    // Bias toward pushes so sequences routinely exceed the 50-entry LRU cap;
    // otherwise random back/forward intermixing keeps |entries| naturally small
    // and the cap invariant is not exercised.
    const actionArb: fc.Arbitrary<Action> = fc.oneof(
      { arbitrary: pushArb, weight: 3 },
      { arbitrary: backArb, weight: 1 },
      { arbitrary: forwardArb, weight: 1 },
    );

    const applyAction = (h: NavHistory, a: Action): NavHistory => {
      if (a.type === "push") return pushEntry(h, a.entry);
      if (a.type === "back") return goBack(h);
      return goForward(h);
    };

    fc.assert(
      fc.property(
        fc.array(actionArb, { minLength: 60, maxLength: 200, size: "max" }),
        (actions) => {
          const final = actions.reduce(applyAction, emptyHistory);
          // LRU cap invariant
          expect(final.entries.length).toBeLessThanOrEqual(MAX_HISTORY_ENTRIES);
          // Head index invariants (ADR-006)
          if (final.entries.length === 0) {
            expect(final.headIndex).toBe(-1);
          } else {
            expect(final.headIndex).toBeGreaterThanOrEqual(0);
            expect(final.headIndex).toBeLessThan(final.entries.length);
          }
        },
      ),
    );
  });
});

// @walking_skeleton @driving_port
describe("LRU eviction at cap of 50 evicts the oldest entry and shifts headIndex", () => {
  it("pushEntry on a 50-entry history at headIndex=49 evicts entries[0] and stays at headIndex=49", () => {
    const entries = makeFiftyEntries();
    const h: NavHistory = { entries, headIndex: 49 };
    const e50: NavEntry = { k: "e50" };
    const next = pushEntry(h, e50);
    expect(next.entries.length).toBe(50);
    expect(next.entries[0]).not.toEqual(h.entries[0]); // oldest evicted
    expect(next.entries[49]).toEqual(e50);
    expect(next.headIndex).toBe(49);
  });
});

// @walking_skeleton @driving_port
describe("emptyHistory sentinel encodes the no-head-yet state", () => {
  it("emptyHistory has zero entries and headIndex=-1", () => {
    // Pins the sentinel shape so any drift in the literal (entries non-empty,
    // headIndex flipped to a non-negative value) is caught immediately.
    expect(emptyHistory.entries).toEqual([]);
    expect(emptyHistory.entries.length).toBe(0);
    expect(emptyHistory.headIndex).toBe(-1);
    // canGoBack/canGoForward must both reject on the sentinel.
    expect(canGoBack(emptyHistory)).toBe(false);
    expect(canGoForward(emptyHistory)).toBe(false);
  });
});

// @walking_skeleton @driving_port
describe("canGoBack is true for any history with headIndex > 0", () => {
  it("canGoBack returns true on a 4-entry history at headIndex=2", () => {
    // Pins the positive branch of canGoBack so a mutation that always returns
    // false (e.g. `headIndex > 0` -> `false`) is caught.
    const h = makeHistoryWith4Entries(2);
    expect(canGoBack(h)).toBe(true);
  });
});

// @walking_skeleton @driving_port
describe("LRU cap does not evict when the resulting stack would be exactly at the cap", () => {
  it("pushEntry on a 49-entry history at headIndex=48 grows to 50 without dropping the oldest entry", () => {
    // Pins the strict-greater-than boundary in the cap check: appending must
    // only evict when the resulting length would EXCEED MAX_HISTORY_ENTRIES,
    // never at exact equality. Catches `>` -> `>=` and `>` -> `true`.
    const fortyNine: readonly NavEntry[] = Array.from(
      { length: MAX_HISTORY_ENTRIES - 1 },
      (_, i) => ({ k: `e${i}` }),
    );
    const h: NavHistory = { entries: fortyNine, headIndex: MAX_HISTORY_ENTRIES - 2 };
    const eNew: NavEntry = { k: "eNew" };
    const next = pushEntry(h, eNew);
    expect(next.entries.length).toBe(MAX_HISTORY_ENTRIES);
    expect(next.entries[0]).toEqual({ k: "e0" }); // oldest preserved (not evicted)
    expect(next.entries[MAX_HISTORY_ENTRIES - 1]).toEqual(eNew);
    expect(next.headIndex).toBe(MAX_HISTORY_ENTRIES - 1);
  });
});
