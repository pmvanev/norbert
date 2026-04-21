/**
 * Acceptance tests: ScopePrecedence pre-highlight ordering (config-cross-references)
 *
 * Validates the pure ScopePrecedence helper per ADR-004: project > plugin > user.
 * Used by the disambiguation popover to pre-highlight a candidate without
 * silently resolving (KPI #5 guardrail).
 *
 * Driving port: ScopePrecedence.preHighlight(candidates) -> index. Pure function.
 *
 * Traces to:
 *   milestone-1-resolution-and-disambiguation.feature
 *     -- Disambiguation popover pre-highlights project over plugin over user
 *     -- When no project candidate exists the plugin-scope candidate is pre-highlighted
 *   user-stories.md US-108, ADR-004
 */

import { describe, it } from "vitest";

// @milestone-1 @driving_port
describe("Disambiguation popover pre-highlights project over plugin over user", () => {
  it.skip("preHighlight returns the index of the project-scope candidate when one is present", () => {
    // const candidates = [userEntry, pluginEntry, projectEntry];
    // expect(preHighlight(candidates)).toBe(2);
  });
});

// @milestone-1 @driving_port
describe("When no project candidate exists the plugin-scope candidate is pre-highlighted", () => {
  it.skip("preHighlight returns the index of the plugin-scope candidate when project is absent", () => {
    // const candidates = [userEntry, pluginEntry];
    // expect(preHighlight(candidates)).toBe(1);
  });
});

// @milestone-1 @driving_port
describe("When only user-scope candidates exist the first is pre-highlighted", () => {
  it.skip("preHighlight returns 0 for an all-user-scope list", () => {
    // const candidates = [userEntryA, userEntryB];
    // expect(preHighlight(candidates)).toBe(0);
  });
});

// @milestone-1 @driving_port @property
describe("preHighlight is total and returns a valid index for any non-empty candidate list", () => {
  it.skip("property: 0 <= preHighlight(candidates) < candidates.length for any non-empty candidates", () => {
    // fc.assert(fc.property(nonEmptyCandidatesArb, (candidates) => {
    //   const idx = preHighlight(candidates);
    //   return idx >= 0 && idx < candidates.length;
    // }));
  });
});
