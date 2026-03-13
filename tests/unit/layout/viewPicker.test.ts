/**
 * Unit tests: View Picker grouping
 *
 * Pure function: buildViewPickerGroups(pluginRegistry) -> ViewPickerGroup[]
 * Groups views by pluginId for searchable picker display.
 */

import { describe, it, expect } from "vitest";
import { buildViewPickerGroups, type ViewPickerGroup } from "../../../src/layout/viewPicker";
import { createPluginRegistry, addView } from "../../../src/plugins/pluginRegistry";
import type { ViewRegistration } from "../../../src/plugins/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeView = (
  id: string,
  pluginId: string,
  label: string
): ViewRegistration => ({
  id,
  pluginId,
  label,
  icon: "icon",
  primaryView: false,
  minWidth: 200,
  minHeight: 100,
  floatMetric: null,
});

// ---------------------------------------------------------------------------
// buildViewPickerGroups
// ---------------------------------------------------------------------------

describe("buildViewPickerGroups", () => {
  it("returns empty array for empty registry", () => {
    const registry = createPluginRegistry();
    const groups = buildViewPickerGroups(registry);
    expect(groups).toEqual([]);
  });

  it("groups views by pluginId", () => {
    let registry = createPluginRegistry();
    registry = addView(registry, makeView("v1", "plugin-a", "View 1"));
    registry = addView(registry, makeView("v2", "plugin-a", "View 2"));
    registry = addView(registry, makeView("v3", "plugin-b", "View 3"));

    const groups = buildViewPickerGroups(registry);

    expect(groups.length).toBe(2);
    const groupA = groups.find((g) => g.pluginId === "plugin-a");
    expect(groupA!.views.length).toBe(2);
    const groupB = groups.find((g) => g.pluginId === "plugin-b");
    expect(groupB!.views.length).toBe(1);
  });

  it("preserves view registration details in groups", () => {
    let registry = createPluginRegistry();
    registry = addView(registry, makeView("session-list", "norbert-session", "Session List"));

    const groups = buildViewPickerGroups(registry);
    const view = groups[0].views[0];

    expect(view.id).toBe("session-list");
    expect(view.label).toBe("Session List");
    expect(view.pluginId).toBe("norbert-session");
  });
});
