/**
 * Acceptance tests: Layout Persistence and Named Presets (US-008)
 *
 * Validates auto-save on every layout change, named presets with
 * save/recall, built-in presets, and the "Reset to Default" escape hatch.
 *
 * Driving ports: PresetControl port, LayoutPersistence port
 * These tests invoke through the preset and persistence interfaces,
 * never through internal Layout Persistor debounce or file I/O.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { LayoutState, PresetState, ZoneRegistry } from "../../../src/layout/types";
import { addZone, createZoneRegistry, setZoneView } from "../../../src/layout/zoneRegistry";
import {
  serializeLayout,
  deserializeLayout,
  validateViewIds,
} from "../../../src/layout/layoutPersistor";
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
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User arranges workspace and arrangement survives restart", () => {
  it("layout with zone assignments and divider position persists across restart", () => {
    // GIVEN: the user has arranged Session List in Main
    //        and Session Detail in Secondary at 60/40 split
    const zones = setZoneView(
      addZone(
        setZoneView(createZoneRegistry(), "main", "session-list", "core"),
        "secondary",
        { viewId: "session-detail", pluginId: "core" }
      ),
      "main",
      "session-list",
      "core"
    );
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.6,
      activePreset: "default",
    };

    // WHEN: the user restarts Norbert (serialize then deserialize)
    const serialized = serializeLayout(layout);
    const restored = deserializeLayout(serialized);

    // THEN: Session List appears in Main zone
    expect(restored.zones.get("main")?.viewId).toBe("session-list");
    // AND: Session Detail appears in Secondary zone
    expect(restored.zones.get("secondary")?.viewId).toBe("session-detail");
    // AND: the divider is at the 60/40 position
    expect(restored.dividerPosition).toBe(0.6);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Auto-Save
// ---------------------------------------------------------------------------

describe("Layout auto-saves on every change", () => {
  it("divider drag triggers automatic save without manual action", () => {
    // GIVEN: the user has Main and Secondary zones visible
    const zones = addZone(
      setZoneView(createZoneRegistry(), "main", "session-list", "core"),
      "secondary",
      { viewId: "session-detail", pluginId: "core" }
    );
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };

    // WHEN: the user drags the divider to a new position
    // Auto-save means: every layout change produces a serializable snapshot.
    // The debounce/write is an effect boundary; here we verify the pure
    // serialization captures the change without manual action.
    const updatedLayout: LayoutState = { ...layout, dividerPosition: 0.7 };
    const serialized = serializeLayout(updatedLayout);
    const restored = deserializeLayout(serialized);

    // THEN: the layout is updated automatically
    expect(restored.dividerPosition).toBe(0.7);
    // AND: all zone assignments are preserved
    expect(restored.zones.get("main")?.viewId).toBe("session-list");
    expect(restored.zones.get("secondary")?.viewId).toBe("session-detail");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Named Presets
// ---------------------------------------------------------------------------

describe("Save named layout preset", () => {
  it("preset saves current layout and appears in the Layout Picker", () => {
    // GIVEN: the user has arranged a preferred layout
    const zones = setZoneView(
      addZone(
        setZoneView(createZoneRegistry(), "main", "session-list", "core"),
        "secondary",
        { viewId: "session-detail", pluginId: "core" }
      ),
      "main",
      "session-list",
      "core"
    );
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.6,
      activePreset: "default",
    };

    // WHEN: the user selects "Save Current Layout As..." and types "Monitoring"
    const preset = createPreset("Monitoring", layout);

    // THEN: the preset "Monitoring" is saved with the current layout
    expect(preset.name).toBe("Monitoring");
    expect(preset.isBuiltIn).toBe(false);
    expect(preset.zones.get("main")?.viewId).toBe("session-list");
    expect(preset.zones.get("secondary")?.viewId).toBe("session-detail");
    expect(preset.dividerPosition).toBe(0.6);

    // AND: it appears in a presets list (simulating Layout Picker)
    const presets: readonly PresetState[] = [getDefaultPreset(), preset];
    expect(presets.some((p) => p.name === "Monitoring")).toBe(true);
  });
});

describe("Switch between layout presets", () => {
  it("selecting a preset instantly changes the layout", () => {
    // GIVEN: the user has "Monitoring" and "Cost Review" presets saved
    const monitoringZones = setZoneView(
      createZoneRegistry(),
      "main",
      "session-list",
      "core"
    );
    const monitoringPreset = createPreset("Monitoring", {
      zones: monitoringZones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    });

    const costReviewZones = setZoneView(
      addZone(
        setZoneView(createZoneRegistry(), "main", "session-detail", "core"),
        "secondary",
        { viewId: "session-list", pluginId: "core" }
      ),
      "main",
      "session-detail",
      "core"
    );
    const costReviewPreset = createPreset("Cost Review", {
      zones: costReviewZones,
      floatingPanels: [],
      dividerPosition: 0.7,
      activePreset: "default",
    });

    // WHEN: the user selects "Cost Review"
    const newLayout = applyPreset(costReviewPreset);

    // THEN: the layout changes to match the "Cost Review" preset
    expect(newLayout.zones.get("main")?.viewId).toBe("session-detail");
    expect(newLayout.zones.get("secondary")?.viewId).toBe("session-list");
    expect(newLayout.dividerPosition).toBe(0.7);
    expect(newLayout.activePreset).toBe("Cost Review");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Built-in presets cannot be deleted", () => {
  it("no Delete option for built-in presets, Save Copy available", () => {
    // GIVEN: the default preset is built-in
    const defaultPreset = getDefaultPreset();
    const presets: readonly PresetState[] = [defaultPreset];

    // WHEN: the user attempts to delete the built-in "Default" preset
    const afterDelete = deletePreset(presets, 0);

    // THEN: the built-in preset is NOT deleted (list unchanged)
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].name).toBe("Default");
    expect(afterDelete[0].isBuiltIn).toBe(true);

    // AND: "Save Copy As..." creates a custom copy named "My Default"
    const copy = saveCopyOfPreset(defaultPreset, "My Default");
    expect(copy.name).toBe("My Default");
    expect(copy.isBuiltIn).toBe(false);
    // The copy has the same layout
    expect([...copy.zones.entries()]).toEqual([...defaultPreset.zones.entries()]);
    expect(copy.dividerPosition).toBe(defaultPreset.dividerPosition);

    // AND: "My Default" can be deleted
    const presetsWithCopy: readonly PresetState[] = [defaultPreset, copy];
    const afterDeleteCopy = deletePreset(presetsWithCopy, 1);
    expect(afterDeleteCopy).toHaveLength(1);
    expect(afterDeleteCopy[0].name).toBe("Default");
  });
});

describe("Reset to Default layout", () => {
  it("layout resets to single Main zone with first available primary view", () => {
    // GIVEN: the user has a complex multi-zone layout with floating panels
    const complexZones = setZoneView(
      addZone(
        setZoneView(createZoneRegistry(), "main", "session-detail", "core"),
        "secondary",
        { viewId: "session-list", pluginId: "core" }
      ),
      "main",
      "session-detail",
      "core"
    );
    const complexLayout: LayoutState = {
      zones: complexZones,
      floatingPanels: [
        {
          viewId: "metrics",
          pluginId: "monitoring",
          position: { x: 100, y: 100 },
          size: { width: 300, height: 200 },
          minimized: false,
          floatMetric: null,
        },
      ],
      dividerPosition: 0.3,
      activePreset: "custom",
    };

    // WHEN: the user selects "Reset to Default"
    const resetLayout = resetToDefault();

    // THEN: the layout resets to single Main zone
    expect(resetLayout.zones.size).toBe(1);
    expect(resetLayout.zones.has("main")).toBe(true);
    expect(resetLayout.zones.get("main")?.viewId).toBeNull();
    // AND: the Secondary zone is hidden (not present)
    expect(resetLayout.zones.has("secondary")).toBe(false);
    // AND: all floating panels are closed
    expect(resetLayout.floatingPanels).toHaveLength(0);
    // AND: divider at default position
    expect(resetLayout.dividerPosition).toBe(0.5);
    // AND: active preset is "Default"
    expect(resetLayout.activePreset).toBe("Default");
  });
});

describe("Preset referencing uninstalled plugin shows graceful empty state", () => {
  it("zone shows explanation when preset references missing plugin view", () => {
    // GIVEN: the user saved a preset that assigns "nwave-wave-flow" to Main
    const zones = setZoneView(
      addZone(
        setZoneView(createZoneRegistry(), "main", "nwave-wave-flow", "nwave"),
        "secondary",
        { viewId: "session-detail", pluginId: "core" }
      ),
      "main",
      "nwave-wave-flow",
      "nwave"
    );
    const preset = createPreset("Wave Flow", {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    });

    // AND: the nWave plugin has been uninstalled
    const availableViewIds = new Set(["session-list", "session-detail"]);

    // WHEN: the user selects that preset from the Layout Picker
    const applied = applyPreset(preset);
    const validated = validateViewIds(applied, availableViewIds);

    // THEN: Main shows empty state (viewId is null for missing plugin)
    expect(validated.zones.get("main")?.viewId).toBeNull();
    expect(validated.zones.get("main")?.pluginId).toBeNull();
    // AND: Secondary zone (assigned to an available view) loads normally
    expect(validated.zones.get("secondary")?.viewId).toBe("session-detail");
    expect(validated.zones.get("secondary")?.pluginId).toBe("core");
  });
});

describe("Layout restore validates view IDs against current plugin registry", () => {
  it("invalid view IDs are detected and replaced with empty state", () => {
    // GIVEN: layout file references a view ID from a now-uninstalled plugin
    const zones = setZoneView(
      addZone(
        setZoneView(createZoneRegistry(), "main", "session-list", "core"),
        "secondary",
        { viewId: "uninstalled-view", pluginId: "removed-plugin" }
      ),
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

    // Available view IDs from current plugin registry
    const availableViewIds = new Set(["session-list", "session-detail"]);

    // WHEN: Norbert restores the layout and validates view IDs
    const serialized = serializeLayout(layout);
    const restored = deserializeLayout(serialized);
    const validated = validateViewIds(restored, availableViewIds);

    // THEN: the zone with invalid view ID shows an empty state
    expect(validated.zones.get("secondary")?.viewId).toBeNull();
    expect(validated.zones.get("secondary")?.pluginId).toBeNull();
    // AND: remaining zones with valid views restore normally
    expect(validated.zones.get("main")?.viewId).toBe("session-list");
    expect(validated.zones.get("main")?.pluginId).toBe("core");
  });
});

// @property
describe("Layout save-restore roundtrip preserves all state", () => {
  // Generators for domain types
  const zoneStateArb = fc.record({
    viewId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    pluginId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  });

  const zoneNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(
    (s) => s.trim().length > 0
  );

  const zonesArb = fc
    .array(fc.tuple(zoneNameArb, zoneStateArb), { minLength: 0, maxLength: 5 })
    .map((entries): ZoneRegistry => {
      let registry = createZoneRegistry();
      for (const [name, state] of entries) {
        registry = addZone(registry, name, state);
      }
      return registry;
    });

  const positionArb = fc.record({
    x: fc.double({ min: 0, max: 2000, noNaN: true }),
    y: fc.double({ min: 0, max: 2000, noNaN: true }),
  });

  const sizeArb = fc.record({
    width: fc.double({ min: 50, max: 2000, noNaN: true }),
    height: fc.double({ min: 50, max: 2000, noNaN: true }),
  });

  const floatingPanelArb = fc.record({
    viewId: fc.string({ minLength: 1, maxLength: 20 }),
    pluginId: fc.string({ minLength: 1, maxLength: 20 }),
    position: positionArb,
    size: sizeArb,
    minimized: fc.boolean(),
    floatMetric: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  });

  const layoutStateArb = fc.record({
    zones: zonesArb,
    floatingPanels: fc.array(floatingPanelArb, { minLength: 0, maxLength: 3 }),
    dividerPosition: fc.double({ min: 0.0, max: 1.0, noNaN: true }),
    activePreset: fc.string({ minLength: 1, maxLength: 20 }),
  });

  it("saving and restoring produces identical layout state", () => {
    fc.assert(
      fc.property(layoutStateArb, (layout) => {
        const serialized = serializeLayout(layout);
        const restored = deserializeLayout(serialized);

        // Zone entries match
        expect([...restored.zones.entries()]).toEqual([...layout.zones.entries()]);
        // Floating panels match
        expect(restored.floatingPanels).toEqual(layout.floatingPanels);
        // Divider position matches
        expect(restored.dividerPosition).toBe(layout.dividerPosition);
        // Active preset matches
        expect(restored.activePreset).toBe(layout.activePreset);
      }),
      { numRuns: 200 }
    );
  });
});

describe("Custom presets can be renamed and deleted", () => {
  it("renamed preset appears under new name, deleted preset disappears", () => {
    // GIVEN: the user has a custom preset "Monitoring"
    const monitoringPreset = createPreset("Monitoring", {
      zones: setZoneView(createZoneRegistry(), "main", "session-list", "core"),
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    });
    const presets: readonly PresetState[] = [getDefaultPreset(), monitoringPreset];

    // WHEN: the user renames it to "Session Monitoring"
    const renamed = renamePreset(presets, 1, "Session Monitoring");

    // THEN: it appears as "Session Monitoring" in the Layout Picker
    expect(renamed[1].name).toBe("Session Monitoring");
    expect(renamed).toHaveLength(2);

    // WHEN: the user deletes "Session Monitoring"
    const afterDelete = deletePreset(renamed, 1);

    // THEN: it no longer appears in the Layout Picker
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete.some((p) => p.name === "Session Monitoring")).toBe(false);
  });
});
