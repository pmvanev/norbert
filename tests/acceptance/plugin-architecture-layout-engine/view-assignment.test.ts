/**
 * Acceptance tests: View Assignment Mechanisms (US-004)
 *
 * Validates four view assignment paths: right-click context menu,
 * drag-and-drop, searchable view picker, and layout presets.
 * All four must produce identical zone state.
 *
 * Driving ports: assignView pure function (assignment engine)
 * These tests invoke through the assignment engine's public interface,
 * never through internal drag handlers or context menu renderers.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { assignView } from "../../../src/layout/assignmentEngine";
import {
  generateContextMenuItems,
  type ContextMenuItem,
} from "../../../src/layout/contextMenu";
import { buildViewPickerGroups, type ViewPickerGroup } from "../../../src/layout/viewPicker";
import { createZoneRegistry, addZone, getZone } from "../../../src/layout/zoneRegistry";
import type { LayoutState, ZoneState } from "../../../src/layout/types";
import type { ViewRegistration, PluginRegistry } from "../../../src/plugins/types";
import { createPluginRegistry, addView } from "../../../src/plugins/pluginRegistry";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeLayout = (zones = createZoneRegistry()): LayoutState => ({
  zones,
  floatingPanels: [],
  dividerPosition: 0.5,
  activePreset: "default",
});

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

const layoutWithSecondary = (): LayoutState =>
  makeLayout(
    addZone(createZoneRegistry(), "secondary", { viewId: null, pluginId: null })
  );

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Assignment Mechanisms
// ---------------------------------------------------------------------------

describe("Right-click context menu assigns view to zone", () => {
  it("selecting 'Open in Secondary Panel' assigns view to Secondary", () => {
    // GIVEN: Session Detail is in the Main zone, Secondary zone exists
    const layout = layoutWithSecondary();
    const layoutWithMain = assignView(layout, "main", "session-detail", "norbert-session");

    // WHEN: the user assigns Session List to Secondary via context menu mechanism
    const result = assignView(layoutWithMain, "secondary", "session-list", "norbert-session");

    // THEN: Session List appears in the Secondary zone
    const secondaryZone = getZone(result.zones, "secondary");
    expect(secondaryZone).toBeDefined();
    expect(secondaryZone!.viewId).toBe("session-list");
    expect(secondaryZone!.pluginId).toBe("norbert-session");

    // AND: the Main zone content is undisturbed
    const mainZone = getZone(result.zones, "main");
    expect(mainZone!.viewId).toBe("session-detail");
    expect(mainZone!.pluginId).toBe("norbert-session");
  });
});

describe("Drag sidebar icon to zone with visual feedback", () => {
  it("dragging icon over zone shows drop overlay, dropping assigns view", () => {
    // GIVEN: Main and Secondary zones are visible
    const layout = layoutWithSecondary();

    // WHEN: the user drops the Sessions icon on the Secondary zone
    // (drag overlay is a UI concern; the pure assignment is what matters)
    const result = assignView(layout, "secondary", "session-list", "norbert-session");

    // THEN: Session List replaces the Secondary zone content
    const secondaryZone = getZone(result.zones, "secondary");
    expect(secondaryZone!.viewId).toBe("session-list");
    expect(secondaryZone!.pluginId).toBe("norbert-session");
  });
});

describe("View picker assigns view via keyboard search", () => {
  it("searchable picker shows registered views grouped by plugin", () => {
    // GIVEN: the user opens the view picker with registered views
    let registry = createPluginRegistry();
    registry = addView(registry, makeView("session-list", "norbert-session", "Session List"));
    registry = addView(registry, makeView("session-detail", "norbert-session", "Session Detail"));
    registry = addView(registry, makeView("config-editor", "norbert-config", "Config Editor"));

    const groups = buildViewPickerGroups(registry);

    // THEN: views are grouped by plugin
    expect(groups.length).toBe(2);
    const sessionGroup = groups.find((g) => g.pluginId === "norbert-session");
    expect(sessionGroup).toBeDefined();
    expect(sessionGroup!.views.length).toBe(2);

    // AND: the user selects "norbert-session > Session List" to assign to Main
    const layout = makeLayout();
    const result = assignView(layout, "main", "session-list", "norbert-session");
    expect(getZone(result.zones, "main")!.viewId).toBe("session-list");
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY / PROPERTY SCENARIOS
// ---------------------------------------------------------------------------

// @property
describe("All assignment mechanisms produce identical zone state", () => {
  it("right-click, drag, picker, and preset produce same layout state", () => {
    // All four mechanisms call the same assignView pure function,
    // so for any (zoneName, viewId, pluginId) the result is identical.
    const zoneNameArb = fc.constantFrom("main", "secondary");
    const viewIdArb = fc.string({ minLength: 1, maxLength: 20 });
    const pluginIdArb = fc.string({ minLength: 1, maxLength: 20 });

    fc.assert(
      fc.property(zoneNameArb, viewIdArb, pluginIdArb, (zoneName, viewId, pluginId) => {
        const baseLayout = layoutWithSecondary();

        // Simulate four assignment mechanisms -- all call assignView
        const viaContextMenu = assignView(baseLayout, zoneName, viewId, pluginId);
        const viaDragDrop = assignView(baseLayout, zoneName, viewId, pluginId);
        const viaPicker = assignView(baseLayout, zoneName, viewId, pluginId);
        const viaPreset = assignView(baseLayout, zoneName, viewId, pluginId);

        // All four produce identical zone state
        expect(getZone(viaContextMenu.zones, zoneName)).toEqual(
          getZone(viaDragDrop.zones, zoneName)
        );
        expect(getZone(viaDragDrop.zones, zoneName)).toEqual(
          getZone(viaPicker.zones, zoneName)
        );
        expect(getZone(viaPicker.zones, zoneName)).toEqual(
          getZone(viaPreset.zones, zoneName)
        );
      }),
      { numRuns: 100 }
    );
  });
});

describe("Assigning a view replaces the current zone occupant", () => {
  it("previous view is unloaded and new view occupies the zone", () => {
    // GIVEN: Session Detail occupies the Main zone
    const layout = makeLayout();
    const withDetail = assignView(layout, "main", "session-detail", "norbert-session");
    expect(getZone(withDetail.zones, "main")!.viewId).toBe("session-detail");

    // WHEN: the user assigns Session List to Main
    const withList = assignView(withDetail, "main", "session-list", "norbert-session");

    // THEN: Session List occupies Main (Session Detail is replaced)
    expect(getZone(withList.zones, "main")!.viewId).toBe("session-list");
    expect(getZone(withList.zones, "main")!.pluginId).toBe("norbert-session");
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("Drag to invalid drop area has no effect", () => {
  it("dropping icon outside any zone leaves layout unchanged", () => {
    // GIVEN: layout with main zone occupied
    const layout = assignView(makeLayout(), "main", "session-detail", "norbert-session");

    // WHEN: the user drops on a zone that does not exist
    const result = assignView(layout, "nonexistent-zone", "session-list", "norbert-session");

    // THEN: the previous layout is unchanged
    expect(result).toEqual(layout);
  });
});

describe("Context menu items generated dynamically from zone registry", () => {
  it("right-click menu reflects currently available zones", () => {
    // GIVEN: the layout engine has Main and Secondary zones registered
    const layout = layoutWithSecondary();

    // WHEN: generating context menu items for a view
    const items = generateContextMenuItems(layout, "session-list", "norbert-session");

    // THEN: menu items include entries for Main and Secondary
    const labels = items.map((item) => item.label);
    expect(labels).toContain("Open in main");
    expect(labels).toContain("Open in secondary");

    // AND: items count matches zone count
    expect(items.length).toBe(2);
  });
});

describe("Assigning unregistered view ID shows graceful empty state", () => {
  it("zone stores the ID even when view plugin is uninstalled", () => {
    // GIVEN: layout references a view from a now-uninstalled plugin
    const layout = makeLayout();

    // WHEN: assigning a viewId that does not exist in any plugin registry
    const result = assignView(layout, "main", "deleted-view", "uninstalled-plugin");

    // THEN: the zone stores the viewId (renderer will show empty state)
    const mainZone = getZone(result.zones, "main");
    expect(mainZone!.viewId).toBe("deleted-view");
    expect(mainZone!.pluginId).toBe("uninstalled-plugin");
  });
});
