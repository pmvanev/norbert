/**
 * Unit tests: Preset Manager (pure functions)
 *
 * Tests preset creation, application, renaming, deletion,
 * built-in protection, and default reset.
 * Uses property-based testing for domain invariants.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { LayoutState, PresetState } from "../../../src/layout/types";
import {
  addZone,
  createZoneRegistry,
  setZoneView,
} from "../../../src/layout/zoneRegistry";
import {
  createPreset,
  applyPreset,
  renamePreset,
  deletePreset,
  getDefaultPreset,
  resetToDefault,
  saveCopyOfPreset,
} from "../../../src/layout/presetManager";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const zoneStateArb = fc.record({
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

const presetNameArb = fc.string({ minLength: 1, maxLength: 30 }).filter(
  (s) => s.trim().length > 0
);

// ---------------------------------------------------------------------------
// createPreset
// ---------------------------------------------------------------------------

describe("createPreset", () => {
  it("creates a custom preset with the given name and layout", () => {
    const zones = setZoneView(createZoneRegistry(), "main", "session-list", "core");
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.6,
      activePreset: "default",
    };

    const preset = createPreset("My Preset", layout);

    expect(preset.name).toBe("My Preset");
    expect(preset.isBuiltIn).toBe(false);
    expect(preset.zones.get("main")?.viewId).toBe("session-list");
    expect(preset.dividerPosition).toBe(0.6);
    expect(preset.floatingPanels).toEqual([]);
  });

  // Property: created presets are never built-in
  it("created presets are always custom (not built-in)", () => {
    fc.assert(
      fc.property(presetNameArb, layoutStateArb, (name, layout) => {
        const preset = createPreset(name, layout);
        expect(preset.isBuiltIn).toBe(false);
        expect(preset.name).toBe(name);
      }),
      { numRuns: 100 }
    );
  });

  // Property: created preset preserves all layout data
  it("preserves zones, floating panels, and divider position from layout", () => {
    fc.assert(
      fc.property(presetNameArb, layoutStateArb, (name, layout) => {
        const preset = createPreset(name, layout);
        expect([...preset.zones.entries()]).toEqual([...layout.zones.entries()]);
        expect(preset.floatingPanels).toEqual(layout.floatingPanels);
        expect(preset.dividerPosition).toBe(layout.dividerPosition);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// applyPreset
// ---------------------------------------------------------------------------

describe("applyPreset", () => {
  it("produces a layout matching the preset with activePreset set to preset name", () => {
    const zones = setZoneView(
      addZone(createZoneRegistry(), "secondary", {
        viewId: "session-detail",
        pluginId: "core",
      }),
      "main",
      "session-list",
      "core"
    );
    const preset: PresetState = {
      name: "Monitoring",
      zones,
      floatingPanels: [],
      dividerPosition: 0.7,
      isBuiltIn: false,
    };

    const layout = applyPreset(preset);

    expect(layout.zones).toBe(preset.zones);
    expect(layout.floatingPanels).toBe(preset.floatingPanels);
    expect(layout.dividerPosition).toBe(0.7);
    expect(layout.activePreset).toBe("Monitoring");
  });

  // Property: apply then create roundtrip preserves layout data
  it("apply(create(name, layout)) preserves all layout data", () => {
    fc.assert(
      fc.property(presetNameArb, layoutStateArb, (name, layout) => {
        const preset = createPreset(name, layout);
        const applied = applyPreset(preset);
        expect([...applied.zones.entries()]).toEqual([...layout.zones.entries()]);
        expect(applied.floatingPanels).toEqual(layout.floatingPanels);
        expect(applied.dividerPosition).toBe(layout.dividerPosition);
        expect(applied.activePreset).toBe(name);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// getDefaultPreset
// ---------------------------------------------------------------------------

describe("getDefaultPreset", () => {
  it("returns a built-in preset named 'Default' with single Main zone", () => {
    const defaultPreset = getDefaultPreset();

    expect(defaultPreset.name).toBe("Default");
    expect(defaultPreset.isBuiltIn).toBe(true);
    expect(defaultPreset.zones.size).toBe(1);
    expect(defaultPreset.zones.has("main")).toBe(true);
    expect(defaultPreset.zones.get("main")?.viewId).toBeNull();
    expect(defaultPreset.floatingPanels).toHaveLength(0);
    expect(defaultPreset.dividerPosition).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// resetToDefault
// ---------------------------------------------------------------------------

describe("resetToDefault", () => {
  it("returns a layout matching the default preset", () => {
    const layout = resetToDefault();
    const defaultPreset = getDefaultPreset();

    expect(layout.zones.size).toBe(1);
    expect(layout.zones.has("main")).toBe(true);
    expect(layout.zones.get("main")?.viewId).toBeNull();
    expect(layout.floatingPanels).toHaveLength(0);
    expect(layout.dividerPosition).toBe(defaultPreset.dividerPosition);
    expect(layout.activePreset).toBe("Default");
  });
});

// ---------------------------------------------------------------------------
// renamePreset
// ---------------------------------------------------------------------------

describe("renamePreset", () => {
  it("renames a custom preset at the given index", () => {
    const preset = createPreset("Old Name", {
      zones: createZoneRegistry(),
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    });
    const presets: readonly PresetState[] = [getDefaultPreset(), preset];

    const renamed = renamePreset(presets, 1, "New Name");

    expect(renamed[1].name).toBe("New Name");
    // Layout data unchanged
    expect(renamed[1].dividerPosition).toBe(0.5);
    expect(renamed[1].isBuiltIn).toBe(false);
    // Other presets unchanged
    expect(renamed[0].name).toBe("Default");
  });

  it("does not rename a built-in preset", () => {
    const presets: readonly PresetState[] = [getDefaultPreset()];

    const renamed = renamePreset(presets, 0, "Renamed Default");

    expect(renamed[0].name).toBe("Default");
  });

  it("returns presets unchanged for out-of-bounds index", () => {
    const presets: readonly PresetState[] = [getDefaultPreset()];

    const renamed = renamePreset(presets, 5, "Nope");

    expect(renamed).toEqual(presets);
  });
});

// ---------------------------------------------------------------------------
// deletePreset
// ---------------------------------------------------------------------------

describe("deletePreset", () => {
  it("removes a custom preset at the given index", () => {
    const custom = createPreset("Custom", {
      zones: createZoneRegistry(),
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    });
    const presets: readonly PresetState[] = [getDefaultPreset(), custom];

    const afterDelete = deletePreset(presets, 1);

    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].name).toBe("Default");
  });

  it("does not delete a built-in preset", () => {
    const presets: readonly PresetState[] = [getDefaultPreset()];

    const afterDelete = deletePreset(presets, 0);

    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].name).toBe("Default");
  });

  it("returns presets unchanged for out-of-bounds index", () => {
    const presets: readonly PresetState[] = [getDefaultPreset()];

    const afterDelete = deletePreset(presets, 5);

    expect(afterDelete).toEqual(presets);
  });

  // Property: delete never removes built-in presets
  it("built-in presets survive any delete attempt", () => {
    fc.assert(
      fc.property(fc.nat({ max: 10 }), (index) => {
        const presets: readonly PresetState[] = [getDefaultPreset()];
        const afterDelete = deletePreset(presets, index);
        expect(afterDelete.filter((p) => p.isBuiltIn)).toHaveLength(1);
      }),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// saveCopyOfPreset
// ---------------------------------------------------------------------------

describe("saveCopyOfPreset", () => {
  it("creates a custom copy of a built-in preset with a new name", () => {
    const defaultPreset = getDefaultPreset();

    const copy = saveCopyOfPreset(defaultPreset, "My Default");

    expect(copy.name).toBe("My Default");
    expect(copy.isBuiltIn).toBe(false);
    expect([...copy.zones.entries()]).toEqual([...defaultPreset.zones.entries()]);
    expect(copy.floatingPanels).toEqual(defaultPreset.floatingPanels);
    expect(copy.dividerPosition).toBe(defaultPreset.dividerPosition);
  });

  // Property: copy is always custom regardless of source
  it("copy is always custom (not built-in)", () => {
    fc.assert(
      fc.property(presetNameArb, (newName) => {
        const source = getDefaultPreset();
        const copy = saveCopyOfPreset(source, newName);
        expect(copy.isBuiltIn).toBe(false);
        expect(copy.name).toBe(newName);
      }),
      { numRuns: 50 }
    );
  });
});
