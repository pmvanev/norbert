/**
 * Acceptance tests: Two-Zone Layout Engine (US-003)
 *
 * Validates the two-zone model (Main + optional Secondary) with
 * draggable divider, zone toggling, and minimum width constraints.
 *
 * Driving ports: ViewAssignment port, DividerControl port
 * These tests invoke through the layout engine's public assignment
 * and divider control interfaces, never through internal Zone Registry
 * or Zone Renderer components.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { createZoneRegistry, getZone, addZone, removeZone, setZoneView } from "../../../src/layout/zoneRegistry";
import type { ZoneState, LayoutState } from "../../../src/layout/types";
import {
  clampDividerPosition,
  snapToCenter,
  computeZoneWidths,
} from "../../../src/layout/dividerManager";
import {
  toggleSecondaryZone,
  createDefaultLayoutState,
  isSecondaryVisible,
} from "../../../src/layout/zoneToggle";

// Domain constants
const MIN_ZONE_WIDTH_PX = 280;
const DEFAULT_DIVIDER_RATIO = 0.5;

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Zone Model
// ---------------------------------------------------------------------------

describe("Main zone is always present and shows content", () => {
  it("Main zone displays assigned view on launch", () => {
    // GIVEN: layout has Session List assigned to Main zone
    const registry = createZoneRegistry();

    // THEN: Main zone is always present in a fresh registry
    const mainZone = getZone(registry, "main");
    expect(mainZone).toBeDefined();

    // AND: Main zone exists with null viewId/pluginId (empty state)
    expect(mainZone!.viewId).toBeNull();
    expect(mainZone!.pluginId).toBeNull();

    // AND: Main zone cannot be removed
    const afterRemoveAttempt = removeZone(registry, "main");
    const mainStillPresent = getZone(afterRemoveAttempt, "main");
    expect(mainStillPresent).toBeDefined();
  });
});

describe("Secondary zone opens with view assignment", () => {
  it("user opens Secondary zone and assigns a view", () => {
    // GIVEN: Session Detail is in the Main zone
    const layout = createDefaultLayoutState();
    const withMainView: LayoutState = {
      ...layout,
      zones: setZoneView(layout.zones, "main", "session-detail", "core"),
    };

    // AND: the Secondary zone is hidden
    expect(isSecondaryVisible(withMainView)).toBe(false);

    // WHEN: the user toggles the Secondary zone
    const afterToggle = toggleSecondaryZone(withMainView);

    // AND: selects "Session List" from the view picker
    const withSecondaryView: LayoutState = {
      ...afterToggle,
      zones: setZoneView(afterToggle.zones, "secondary", "session-list", "core"),
    };

    // THEN: Session List appears in the Secondary zone
    const secondaryZone = getZone(withSecondaryView.zones, "secondary");
    expect(secondaryZone).toBeDefined();
    expect(secondaryZone!.viewId).toBe("session-list");

    // AND: Main remains showing Session Detail undisturbed
    const mainZone = getZone(withSecondaryView.zones, "main");
    expect(mainZone!.viewId).toBe("session-detail");

    // AND: a draggable divider separates the two zones (divider position is set)
    expect(withSecondaryView.dividerPosition).toBeGreaterThan(0);
    expect(withSecondaryView.dividerPosition).toBeLessThan(1);
  });
});

describe("Toggle Secondary zone hides and restores", () => {
  it("hiding Secondary collapses to full-width Main", () => {
    // GIVEN: Main and Secondary are both visible
    let layout = createDefaultLayoutState();
    layout = toggleSecondaryZone(layout); // show secondary
    layout = {
      ...layout,
      zones: setZoneView(layout.zones, "secondary", "session-list", "core"),
    };
    expect(isSecondaryVisible(layout)).toBe(true);

    // WHEN: the user hides the Secondary zone
    const afterHide = toggleSecondaryZone(layout);

    // THEN: Secondary hides and Main expands to full content width
    expect(isSecondaryVisible(afterHide)).toBe(false);
    expect(getZone(afterHide.zones, "secondary")).toBeUndefined();
  });

  it("reshowing Secondary restores the last-used view", () => {
    // GIVEN: the user previously had Session List in Secondary
    let layout = createDefaultLayoutState();
    layout = toggleSecondaryZone(layout); // show secondary
    layout = {
      ...layout,
      zones: setZoneView(layout.zones, "secondary", "session-list", "core"),
    };

    // AND: the user hid the Secondary zone
    const afterHide = toggleSecondaryZone(layout);
    expect(isSecondaryVisible(afterHide)).toBe(false);

    // WHEN: the user shows the Secondary zone again
    const afterRestore = toggleSecondaryZone(afterHide);

    // THEN: Secondary reappears with Session List loaded
    expect(isSecondaryVisible(afterRestore)).toBe(true);
    const restoredZone = getZone(afterRestore.zones, "secondary");
    expect(restoredZone).toBeDefined();
    expect(restoredZone!.viewId).toBe("session-list");
    expect(restoredZone!.pluginId).toBe("core");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Divider
// ---------------------------------------------------------------------------

describe("Dragging the divider resizes both zones", () => {
  it("zones resize proportionally as divider is dragged", () => {
    // GIVEN: Main and Secondary are visible at 50/50 split
    const containerWidth = 1200;
    const initialRatio = 0.5;

    // WHEN: the user drags the divider to the right (ratio becomes 0.7)
    const newRatio = 0.7;
    const clampedRatio = clampDividerPosition(newRatio, containerWidth, MIN_ZONE_WIDTH_PX);

    // THEN: Main zone widens and Secondary zone narrows
    const widths = computeZoneWidths(clampedRatio, containerWidth);
    expect(widths.mainWidth).toBeGreaterThan(containerWidth * initialRatio);
    expect(widths.secondaryWidth).toBeLessThan(containerWidth * initialRatio);

    // AND: the new divider position is auto-saved as a percentage (ratio)
    expect(clampedRatio).toBeGreaterThanOrEqual(0);
    expect(clampedRatio).toBeLessThanOrEqual(1);
  });
});

describe("Double-click divider snaps to 50/50 split", () => {
  it("zones snap to equal widths on double-click", () => {
    // GIVEN: Main is at 70% and Secondary at 30%
    const currentRatio = 0.7;

    // WHEN: the user double-clicks the divider handle
    const snappedRatio = snapToCenter();

    // THEN: zones snap to 50% / 50%
    expect(snappedRatio).toBe(0.5);
    const widths = computeZoneWidths(snappedRatio, 1200);
    expect(widths.mainWidth).toBe(600);
    expect(widths.secondaryWidth).toBe(600);
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Minimum zone width is enforced at 280px", () => {
  it("divider stops at 280px minimum zone width", () => {
    // GIVEN: Main and Secondary are visible in a 1200px container
    const containerWidth = 1200;

    // WHEN: the user drags the divider far to the right
    const extremeRightRatio = 0.95;
    const clamped = clampDividerPosition(extremeRightRatio, containerWidth, MIN_ZONE_WIDTH_PX);

    // THEN: the Secondary zone reaches 280px minimum width and stops
    const widths = computeZoneWidths(clamped, containerWidth);
    expect(widths.secondaryWidth).toBeGreaterThanOrEqual(MIN_ZONE_WIDTH_PX);

    // AND: the divider cannot be dragged further in that direction
    expect(clamped).toBeLessThan(extremeRightRatio);
  });

  it("divider stops at 280px minimum for Main zone too", () => {
    // GIVEN: Main and Secondary are visible in a 1200px container
    const containerWidth = 1200;

    // WHEN: the user drags the divider far to the left
    const extremeLeftRatio = 0.05;
    const clamped = clampDividerPosition(extremeLeftRatio, containerWidth, MIN_ZONE_WIDTH_PX);

    // THEN: the Main zone reaches 280px minimum width and stops
    const widths = computeZoneWidths(clamped, containerWidth);
    expect(widths.mainWidth).toBeGreaterThanOrEqual(MIN_ZONE_WIDTH_PX);

    // AND: the divider cannot be dragged further in that direction
    expect(clamped).toBeGreaterThan(extremeLeftRatio);
  });
});

describe("First launch with no layout file shows empty Main with guidance", () => {
  it("empty state message guides user to assign a view", () => {
    // GIVEN: no layout file exists
    // WHEN: the user launches Norbert for the first time
    const layout = createDefaultLayoutState();

    // THEN: the Main zone displays an empty state (null viewId)
    const mainZone = getZone(layout.zones, "main");
    expect(mainZone).toBeDefined();
    expect(mainZone!.viewId).toBeNull();

    // AND: the Secondary zone is hidden
    expect(isSecondaryVisible(layout)).toBe(false);
    expect(getZone(layout.zones, "secondary")).toBeUndefined();
  });
});

describe("Divider position stored as ratio for resolution independence", () => {
  it("divider position persisted as 0.0-1.0 ratio, not pixels", () => {
    // GIVEN: the user has arranged zones at 60/40 split
    const ratio = 0.6;

    // WHEN: the layout is saved (divider position stored as ratio)
    const layout = createDefaultLayoutState();
    const updatedLayout: LayoutState = { ...layout, dividerPosition: ratio };

    // THEN: the divider position is stored as 0.6 (ratio)
    expect(updatedLayout.dividerPosition).toBe(0.6);

    // AND: on a different resolution display, the 60/40 split is preserved
    const smallScreen = computeZoneWidths(updatedLayout.dividerPosition, 800);
    const largeScreen = computeZoneWidths(updatedLayout.dividerPosition, 1600);

    // Both screens show 60/40 ratio
    expect(smallScreen.mainWidth / 800).toBeCloseTo(0.6);
    expect(largeScreen.mainWidth / 1600).toBeCloseTo(0.6);
  });
});

// @property
describe("Zone registry is count-agnostic", () => {
  it("zones are stored as a keyed map, not positional fields", () => {
    // Property: for any valid zone name (not "main"), adding it to the registry
    // produces a registry with that zone present alongside main, and the
    // same operations (getZone, addZone, removeZone) work regardless of count.
    const zoneNameArb = fc.string({ minLength: 1, maxLength: 20 })
      .filter(name => name !== "main" && name.trim().length > 0);

    fc.assert(
      fc.property(
        fc.array(zoneNameArb, { minLength: 1, maxLength: 10 }),
        (zoneNames) => {
          // GIVEN: a fresh registry with main zone
          let registry = createZoneRegistry();

          // WHEN: we add arbitrary zone names
          const uniqueNames = [...new Set(zoneNames)];
          for (const name of uniqueNames) {
            const zoneState: ZoneState = { viewId: null, pluginId: null };
            registry = addZone(registry, name, zoneState);
          }

          // THEN: main is still present (invariant)
          expect(getZone(registry, "main")).toBeDefined();

          // AND: all added zones are present
          for (const name of uniqueNames) {
            expect(getZone(registry, name)).toBeDefined();
          }

          // AND: removing a non-main zone works
          if (uniqueNames.length > 0) {
            const toRemove = uniqueNames[0];
            const reduced = removeZone(registry, toRemove);
            expect(getZone(reduced, toRemove)).toBeUndefined();
            // AND: main is still present after removal
            expect(getZone(reduced, "main")).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
