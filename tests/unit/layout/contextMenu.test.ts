/**
 * Unit tests: Context Menu generation
 *
 * Pure function: generateContextMenuItems(layout, viewId, pluginId) -> ContextMenuItem[]
 * Items are dynamically generated from zone registry.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  generateContextMenuItems,
  type ContextMenuItem,
} from "../../../src/layout/contextMenu";
import {
  createZoneRegistry,
  addZone,
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

// ---------------------------------------------------------------------------
// generateContextMenuItems
// ---------------------------------------------------------------------------

describe("generateContextMenuItems", () => {
  it("generates one item per zone in registry", () => {
    const zones = addZone(createZoneRegistry(), "secondary", {
      viewId: null,
      pluginId: null,
    });
    const layout = makeLayout(zones);
    const items = generateContextMenuItems(layout, "session-list", "norbert-session");

    expect(items.length).toBe(2); // main + secondary
  });

  it("each item contains the target zone name", () => {
    const zones = addZone(createZoneRegistry(), "secondary", {
      viewId: null,
      pluginId: null,
    });
    const layout = makeLayout(zones);
    const items = generateContextMenuItems(layout, "session-list", "norbert-session");

    const zoneNames = items.map((i) => i.zoneName);
    expect(zoneNames).toContain("main");
    expect(zoneNames).toContain("secondary");
  });

  it("each item has a label derived from zone name", () => {
    const layout = makeLayout();
    const items = generateContextMenuItems(layout, "view-1", "plugin-1");

    expect(items[0].label).toBe("Open in main");
  });

  it("each item carries the viewId and pluginId to assign", () => {
    const layout = makeLayout();
    const items = generateContextMenuItems(layout, "my-view", "my-plugin");

    expect(items[0].viewId).toBe("my-view");
    expect(items[0].pluginId).toBe("my-plugin");
  });

  // Property: item count matches zone count
  it("always generates exactly as many items as zones", () => {
    const zoneNameArb = fc
      .string({ minLength: 1, maxLength: 15 })
      .filter((n) => n !== "main" && n.trim().length > 0);

    fc.assert(
      fc.property(
        fc.array(zoneNameArb, { minLength: 0, maxLength: 5 }),
        (extraZones) => {
          let zones = createZoneRegistry();
          for (const name of new Set(extraZones)) {
            zones = addZone(zones, name, { viewId: null, pluginId: null });
          }
          const layout = makeLayout(zones);
          const items = generateContextMenuItems(layout, "v", "p");
          const zoneCount = listZoneNames(layout.zones).length;
          expect(items.length).toBe(zoneCount);
        }
      ),
      { numRuns: 50 }
    );
  });
});
