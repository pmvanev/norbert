/**
 * Unit tests: Assignment Engine
 *
 * Pure function: assignView(layout, zoneName, viewId, pluginId) -> LayoutState
 * Property-based tests for domain invariants.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { assignView } from "../../../src/layout/assignmentEngine";
import {
  createZoneRegistry,
  addZone,
  getZone,
  listZoneNames,
} from "../../../src/layout/zoneRegistry";
import type { LayoutState } from "../../../src/layout/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLayout = (zones = createZoneRegistry()): LayoutState => ({
  zones,
  floatingPanels: [],
  dividerPosition: 0.5,
  activePreset: "default",
});

const layoutWithSecondary = (): LayoutState =>
  makeLayout(
    addZone(createZoneRegistry(), "secondary", { viewId: null, pluginId: null })
  );

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const viewIdArb = fc.string({ minLength: 1, maxLength: 30 });
const pluginIdArb = fc.string({ minLength: 1, maxLength: 30 });
const existingZoneArb = fc.constantFrom("main", "secondary");

// ---------------------------------------------------------------------------
// assignView — core behavior
// ---------------------------------------------------------------------------

describe("assignView", () => {
  it("assigns viewId and pluginId to an existing zone", () => {
    const layout = makeLayout();
    const result = assignView(layout, "main", "session-list", "norbert-session");

    const mainZone = getZone(result.zones, "main");
    expect(mainZone!.viewId).toBe("session-list");
    expect(mainZone!.pluginId).toBe("norbert-session");
  });

  it("returns layout unchanged when zone does not exist", () => {
    const layout = makeLayout();
    const result = assignView(layout, "nonexistent", "view-1", "plugin-1");
    expect(result).toEqual(layout);
  });

  it("replaces existing view in zone", () => {
    const layout = makeLayout();
    const step1 = assignView(layout, "main", "old-view", "old-plugin");
    const step2 = assignView(step1, "main", "new-view", "new-plugin");

    expect(getZone(step2.zones, "main")!.viewId).toBe("new-view");
    expect(getZone(step2.zones, "main")!.pluginId).toBe("new-plugin");
  });

  it("does not modify other zones when assigning", () => {
    const layout = layoutWithSecondary();
    const withMain = assignView(layout, "main", "view-a", "plugin-a");
    const result = assignView(withMain, "secondary", "view-b", "plugin-b");

    expect(getZone(result.zones, "main")!.viewId).toBe("view-a");
    expect(getZone(result.zones, "secondary")!.viewId).toBe("view-b");
  });

  it("preserves non-zone layout properties", () => {
    const layout: LayoutState = {
      zones: createZoneRegistry(),
      floatingPanels: [],
      dividerPosition: 0.75,
      activePreset: "custom",
    };
    const result = assignView(layout, "main", "view-1", "plugin-1");

    expect(result.dividerPosition).toBe(0.75);
    expect(result.activePreset).toBe("custom");
    expect(result.floatingPanels).toEqual([]);
  });

  // Property: assignView is idempotent
  it("assigning the same view twice produces identical state", () => {
    fc.assert(
      fc.property(existingZoneArb, viewIdArb, pluginIdArb, (zone, viewId, pluginId) => {
        const layout = layoutWithSecondary();
        const once = assignView(layout, zone, viewId, pluginId);
        const twice = assignView(once, zone, viewId, pluginId);
        expect(once).toEqual(twice);
      }),
      { numRuns: 100 }
    );
  });

  // Property: assignView preserves zone count
  it("never adds or removes zones", () => {
    fc.assert(
      fc.property(existingZoneArb, viewIdArb, pluginIdArb, (zone, viewId, pluginId) => {
        const layout = layoutWithSecondary();
        const before = listZoneNames(layout.zones).length;
        const result = assignView(layout, zone, viewId, pluginId);
        const after = listZoneNames(result.zones).length;
        expect(after).toBe(before);
      }),
      { numRuns: 100 }
    );
  });

  // Property: assignView does not mutate input
  it("does not mutate the original layout", () => {
    fc.assert(
      fc.property(existingZoneArb, viewIdArb, pluginIdArb, (zone, viewId, pluginId) => {
        const layout = layoutWithSecondary();
        const originalMainView = getZone(layout.zones, "main")?.viewId;
        assignView(layout, zone, viewId, pluginId);
        expect(getZone(layout.zones, "main")?.viewId).toBe(originalMainView);
      }),
      { numRuns: 100 }
    );
  });
});
