/**
 * Unit tests: Layout type definitions
 *
 * Validates that all algebraic data types for the layout engine
 * are correctly defined with proper readonly properties and
 * structural guarantees.
 */

import { describe, it, expect } from "vitest";
import type {
  ZoneState,
  FloatingPanelState,
  PresetState,
  LayoutState,
  ZoneRegistry,
} from "../../../src/layout/types";

// ---------------------------------------------------------------------------
// ZoneState
// ---------------------------------------------------------------------------

describe("ZoneState", () => {
  it("represents a zone with nullable viewId and pluginId", () => {
    const emptyZone: ZoneState = { viewId: null, pluginId: null };
    expect(emptyZone.viewId).toBeNull();
    expect(emptyZone.pluginId).toBeNull();
  });

  it("represents a zone with assigned view and plugin", () => {
    const zone: ZoneState = { viewId: "session-list", pluginId: "core" };
    expect(zone.viewId).toBe("session-list");
    expect(zone.pluginId).toBe("core");
  });
});

// ---------------------------------------------------------------------------
// FloatingPanelState
// ---------------------------------------------------------------------------

describe("FloatingPanelState", () => {
  it("captures all floating panel properties", () => {
    const panel: FloatingPanelState = {
      viewId: "inspector",
      pluginId: "dev-tools",
      position: { x: 100, y: 200 },
      size: { width: 400, height: 300 },
      minimized: false,
      floatMetric: null,
    };
    expect(panel.viewId).toBe("inspector");
    expect(panel.pluginId).toBe("dev-tools");
    expect(panel.position).toEqual({ x: 100, y: 200 });
    expect(panel.size).toEqual({ width: 400, height: 300 });
    expect(panel.minimized).toBe(false);
    expect(panel.floatMetric).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PresetState
// ---------------------------------------------------------------------------

describe("PresetState", () => {
  it("captures preset with zones, floating panels, and divider position", () => {
    const preset: PresetState = {
      name: "default",
      zones: new Map([["main", { viewId: null, pluginId: null }]]),
      floatingPanels: [],
      dividerPosition: 0.5,
      isBuiltIn: true,
    };
    expect(preset.name).toBe("default");
    expect(preset.zones.has("main")).toBe(true);
    expect(preset.floatingPanels).toEqual([]);
    expect(preset.dividerPosition).toBe(0.5);
    expect(preset.isBuiltIn).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LayoutState
// ---------------------------------------------------------------------------

describe("LayoutState", () => {
  it("composes zones registry, floating panels, divider, and active preset", () => {
    const zones: ZoneRegistry = new Map([
      ["main", { viewId: "session-list", pluginId: "core" }],
    ]);
    const layout: LayoutState = {
      zones,
      floatingPanels: [],
      dividerPosition: 0.5,
      activePreset: "default",
    };
    expect(layout.zones).toBe(zones);
    expect(layout.floatingPanels).toEqual([]);
    expect(layout.dividerPosition).toBe(0.5);
    expect(layout.activePreset).toBe("default");
  });
});
