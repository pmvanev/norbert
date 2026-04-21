/**
 * Acceptance tests: NavAnnouncer announcement contract (config-cross-references)
 *
 * Validates the pure announcementFor(prev, next) helper that produces ARIA
 * live-region text per architecture.md section 6.8 table.
 *
 * Driving port: announcementFor(prev, next) -> string. Pure function.
 *
 * Traces to:
 *   walking-skeleton.feature
 *     -- announcement "Preview open: skill nw-bdd-requirements, user scope"
 *     -- announcement "Switched to skills; now viewing skill nw-bdd-requirements"
 *     -- announcement "Preview closed"
 *     -- announcement "No further history in back direction"
 *   milestone-1-resolution-and-disambiguation.feature
 *     -- announcement "Disambiguation required: 2 candidates for release"
 *   user-stories.md US-110, architecture.md section 6.8
 */

import { describe, it } from "vitest";

// @walking_skeleton @driving_port
describe("Split open is announced with type, name, and scope", () => {
  it.skip("announcementFor(state, refSingleClick into empty split) returns 'Preview open: skill nw-bdd-requirements, user scope'", () => {
    // const text = announcementFor(prev, next);
    // expect(text).toBe("Preview open: skill nw-bdd-requirements, user scope");
  });
});

// @walking_skeleton @driving_port
describe("Bottom-pane replacement is announced as Preview replaced", () => {
  it.skip("announcementFor(splitState, refSingleClick replacing bottom) returns 'Preview replaced: hook pre-release.sh, project scope'", () => {});
});

// @walking_skeleton @driving_port
describe("Split close is announced as Preview closed", () => {
  it.skip("announcementFor(splitState, closeSplit) returns 'Preview closed'", () => {});
});

// @walking_skeleton @driving_port
describe("Cross-sub-tab Ctrl+click commit announces the destination sub-tab and target", () => {
  it.skip("announcementFor(commands, refCtrlClick to skill) returns 'Switched to skills; now viewing skill nw-bdd-requirements'", () => {});
});

// @walking_skeleton @driving_port
describe("Same-sub-tab Ctrl+click commit announces only the target", () => {
  it.skip("announcementFor(skills, refCtrlClick to another skill) returns 'Navigated to skill nw-discovery-methodology'", () => {});
});

// @walking_skeleton @driving_port
describe("End-of-history boundary in back direction is announced", () => {
  it.skip("announcementFor with endOfHistory='back' returns 'No further history in back direction'", () => {});
});

// @walking_skeleton @driving_port
describe("End-of-history boundary in forward direction is announced", () => {
  it.skip("announcementFor with endOfHistory='forward' returns 'No further history in forward direction'", () => {
    // Symmetric counterpart to the back-direction case above.
    // Catches off-by-one bugs in the {direction} substitution in
    // architecture sec 6.8 template "No further history in {direction} direction".
  });
});

// @milestone-1 @driving_port
describe("Disambiguation popover open is announced with candidate count", () => {
  it.skip("announcementFor(no popover, openDisambiguation with 2 candidates) returns 'Disambiguation required: 2 candidates for release'", () => {});
});

// @walking_skeleton @driving_port
describe("Dead-reference click is silent (no announcement)", () => {
  it.skip("announcementFor on a state with no observable change returns the empty string", () => {});
});
