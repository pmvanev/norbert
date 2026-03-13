/**
 * Unit tests: Zone Toggle
 *
 * Pure functions for toggling the Secondary zone on/off,
 * remembering last-used view for restore, and creating default layout state.
 */

import { describe, it, expect } from "vitest";
import {
  toggleSecondaryZone,
  createDefaultLayoutState,
  isSecondaryVisible,
} from "../../../src/layout/zoneToggle";
import { getZone, setZoneView } from "../../../src/layout/zoneRegistry";
import type { LayoutState } from "../../../src/layout/types";

// ---------------------------------------------------------------------------
// createDefaultLayoutState
// ---------------------------------------------------------------------------

describe("createDefaultLayoutState", () => {
  it("creates layout with main zone only", () => {
    const layout = createDefaultLayoutState();
    expect(getZone(layout.zones, "main")).toBeDefined();
    expect(getZone(layout.zones, "secondary")).toBeUndefined();
  });

  it("sets default divider position to 0.5", () => {
    const layout = createDefaultLayoutState();
    expect(layout.dividerPosition).toBe(0.5);
  });

  it("has empty floating panels", () => {
    const layout = createDefaultLayoutState();
    expect(layout.floatingPanels).toEqual([]);
  });

  it("has default active preset", () => {
    const layout = createDefaultLayoutState();
    expect(layout.activePreset).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// isSecondaryVisible
// ---------------------------------------------------------------------------

describe("isSecondaryVisible", () => {
  it("returns false for default layout", () => {
    const layout = createDefaultLayoutState();
    expect(isSecondaryVisible(layout)).toBe(false);
  });

  it("returns true when secondary zone exists", () => {
    const layout = createDefaultLayoutState();
    const withSecondary = toggleSecondaryZone(layout);
    expect(isSecondaryVisible(withSecondary)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggleSecondaryZone
// ---------------------------------------------------------------------------

describe("toggleSecondaryZone", () => {
  it("shows secondary zone when hidden", () => {
    const layout = createDefaultLayoutState();
    const toggled = toggleSecondaryZone(layout);

    expect(isSecondaryVisible(toggled)).toBe(true);
    expect(getZone(toggled.zones, "secondary")).toBeDefined();
  });

  it("hides secondary zone when visible", () => {
    const layout = createDefaultLayoutState();
    const shown = toggleSecondaryZone(layout);
    const hidden = toggleSecondaryZone(shown);

    expect(isSecondaryVisible(hidden)).toBe(false);
    expect(getZone(hidden.zones, "secondary")).toBeUndefined();
  });

  it("preserves main zone through toggle cycle", () => {
    const layout = createDefaultLayoutState();
    const withMainView: LayoutState = {
      ...layout,
      zones: setZoneView(layout.zones, "main", "session-detail", "core"),
    };

    const shown = toggleSecondaryZone(withMainView);
    const hidden = toggleSecondaryZone(shown);

    const mainZone = getZone(hidden.zones, "main");
    expect(mainZone!.viewId).toBe("session-detail");
  });

  it("restores last-used view on re-show", () => {
    let layout = createDefaultLayoutState();

    // Show secondary and assign a view
    layout = toggleSecondaryZone(layout);
    layout = {
      ...layout,
      zones: setZoneView(layout.zones, "secondary", "session-list", "core"),
    };

    // Hide and re-show
    const hidden = toggleSecondaryZone(layout);
    const restored = toggleSecondaryZone(hidden);

    const restoredZone = getZone(restored.zones, "secondary");
    expect(restoredZone!.viewId).toBe("session-list");
    expect(restoredZone!.pluginId).toBe("core");
  });

  it("does not mutate the original layout", () => {
    const layout = createDefaultLayoutState();
    const toggled = toggleSecondaryZone(layout);

    // Original should still have no secondary
    expect(getZone(layout.zones, "secondary")).toBeUndefined();
    // Toggled should have secondary
    expect(getZone(toggled.zones, "secondary")).toBeDefined();
  });

  it("preserves divider position through toggle cycle", () => {
    let layout = createDefaultLayoutState();
    layout = { ...layout, dividerPosition: 0.6 };
    layout = toggleSecondaryZone(layout);
    const hidden = toggleSecondaryZone(layout);
    const restored = toggleSecondaryZone(hidden);
    expect(restored.dividerPosition).toBe(0.6);
  });
});
