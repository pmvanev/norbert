/**
 * Unit tests: Layout Persistor (pure functions)
 *
 * Tests serialization/deserialization of LayoutState and view ID validation.
 * Uses property-based testing for roundtrip invariants and example-based
 * tests for edge cases and validation behavior.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { LayoutState, ZoneState } from "../../../src/layout/types";
import {
  addZone,
  createZoneRegistry,
  setZoneView,
} from "../../../src/layout/zoneRegistry";
import {
  serializeLayout,
  deserializeLayout,
  validateViewIds,
} from "../../../src/layout/layoutPersistor";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const zoneStateArb: fc.Arbitrary<ZoneState> = fc.record({
  viewId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  pluginId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
    nil: null,
  }),
});

const zoneNameArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0);

const zonesArb = fc
  .array(fc.tuple(zoneNameArb, zoneStateArb), {
    minLength: 0,
    maxLength: 5,
  })
  .map((entries) => {
    let registry = createZoneRegistry();
    for (const [name, state] of entries) {
      registry = addZone(registry, name, state);
    }
    return registry;
  });

const floatingPanelArb = fc.record({
  viewId: fc.string({ minLength: 1, maxLength: 20 }),
  pluginId: fc.string({ minLength: 1, maxLength: 20 }),
  position: fc.record({
    x: fc.double({ min: 0, max: 2000, noNaN: true }),
    y: fc.double({ min: 0, max: 2000, noNaN: true }),
  }),
  size: fc.record({
    width: fc.double({ min: 50, max: 2000, noNaN: true }),
    height: fc.double({ min: 50, max: 2000, noNaN: true }),
  }),
  minimized: fc.boolean(),
  floatMetric: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
    nil: null,
  }),
});

const layoutStateArb: fc.Arbitrary<LayoutState> = fc.record({
  zones: zonesArb,
  floatingPanels: fc.array(floatingPanelArb, { minLength: 0, maxLength: 3 }),
  dividerPosition: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
  activePreset: fc.string({ minLength: 1, maxLength: 20 }),
});

// ---------------------------------------------------------------------------
// serializeLayout
// ---------------------------------------------------------------------------

describe("serializeLayout", () => {
  it("produces valid JSON string", () => {
    const layout: LayoutState = {
      zones: createZoneRegistry(),
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const json = serializeLayout(layout);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("serializes Map-based zones into JSON-compatible format", () => {
    const zones = setZoneView(createZoneRegistry(), "main", "session-list", "core");
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const json = serializeLayout(layout);
    const parsed = JSON.parse(json);
    // Zones should be serialized in a way that preserves key-value pairs
    expect(parsed.zones).toBeDefined();
  });

  // Property: serialized output is always valid JSON
  it("always produces valid JSON for any layout state", () => {
    fc.assert(
      fc.property(layoutStateArb, (layout) => {
        const json = serializeLayout(layout);
        expect(() => JSON.parse(json)).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// deserializeLayout
// ---------------------------------------------------------------------------

describe("deserializeLayout", () => {
  it("restores zones as a Map", () => {
    const zones = setZoneView(
      addZone(createZoneRegistry(), "secondary", {
        viewId: "detail",
        pluginId: "core",
      }),
      "main",
      "session-list",
      "core"
    );
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const restored = deserializeLayout(serializeLayout(layout));
    expect(restored.zones).toBeInstanceOf(Map);
    expect(restored.zones.get("main")?.viewId).toBe("session-list");
    expect(restored.zones.get("secondary")?.viewId).toBe("detail");
  });

  it("restores divider position as a number between 0.0 and 1.0", () => {
    const layout: LayoutState = {
      zones: createZoneRegistry(),
      floatingPanels: [],
      dividerPosition: 0.75,
      activePreset: "default",
    };

    const restored = deserializeLayout(serializeLayout(layout));
    expect(restored.dividerPosition).toBe(0.75);
    expect(typeof restored.dividerPosition).toBe("number");
  });

  it("restores floating panels with all fields", () => {
    const layout: LayoutState = {
      zones: createZoneRegistry(),
      floatingPanels: [
        {
          viewId: "metrics",
          pluginId: "monitoring",
          position: { x: 100, y: 200 },
          size: { width: 400, height: 300 },
          minimized: false,
          floatMetric: "cpu-usage",
        },
      ],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const restored = deserializeLayout(serializeLayout(layout));
    expect(restored.floatingPanels).toHaveLength(1);
    expect(restored.floatingPanels[0].viewId).toBe("metrics");
    expect(restored.floatingPanels[0].position).toEqual({ x: 100, y: 200 });
    expect(restored.floatingPanels[0].size).toEqual({ width: 400, height: 300 });
    expect(restored.floatingPanels[0].floatMetric).toBe("cpu-usage");
  });
});

// ---------------------------------------------------------------------------
// validateViewIds
// ---------------------------------------------------------------------------

describe("validateViewIds", () => {
  it("preserves zones with valid view IDs", () => {
    const zones = setZoneView(createZoneRegistry(), "main", "session-list", "core");
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const availableViewIds = new Set(["session-list"]);
    const validated = validateViewIds(layout, availableViewIds);
    expect(validated.zones.get("main")?.viewId).toBe("session-list");
    expect(validated.zones.get("main")?.pluginId).toBe("core");
  });

  it("replaces invalid view IDs with null (graceful empty state)", () => {
    const zones = setZoneView(createZoneRegistry(), "main", "removed-view", "gone-plugin");
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const availableViewIds = new Set(["session-list"]);
    const validated = validateViewIds(layout, availableViewIds);
    expect(validated.zones.get("main")?.viewId).toBeNull();
    expect(validated.zones.get("main")?.pluginId).toBeNull();
  });

  it("preserves zones with null view IDs (already empty)", () => {
    const layout: LayoutState = {
      zones: createZoneRegistry(), // main zone has null viewId
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    const availableViewIds = new Set(["session-list"]);
    const validated = validateViewIds(layout, availableViewIds);
    expect(validated.zones.get("main")?.viewId).toBeNull();
  });

  it("does not modify divider position or active preset", () => {
    const zones = setZoneView(createZoneRegistry(), "main", "bad-view", "bad-plugin");
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.8,
      activePreset: "custom",
    };

    const validated = validateViewIds(layout, new Set());
    expect(validated.dividerPosition).toBe(0.8);
    expect(validated.activePreset).toBe("custom");
  });

  // Property: validation never increases the number of assigned views
  it("never introduces view IDs not in the available set", () => {
    fc.assert(
      fc.property(layoutStateArb, (layout) => {
        const availableViewIds = new Set(["session-list", "session-detail"]);
        const validated = validateViewIds(layout, availableViewIds);

        for (const [, zone] of validated.zones) {
          if (zone.viewId !== null) {
            expect(availableViewIds.has(zone.viewId)).toBe(true);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
