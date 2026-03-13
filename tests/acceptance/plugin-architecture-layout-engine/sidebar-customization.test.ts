/**
 * Acceptance tests: Sidebar Icon Visibility and Reorder (US-007)
 *
 * Validates that sidebar icons can be shown/hidden via right-click,
 * reordered via drag, and that hidden sections remain accessible
 * through the command palette.
 *
 * Driving ports: VisibilityToggle port, Reorder port, Reset port
 * These tests invoke through the sidebar manager's public interfaces,
 * never through internal renderers or persistence internals.
 */

import { describe, it, expect } from "vitest";
import type { ViewRegistration } from "../../../src/plugins/types";
import type { SidebarState } from "../../../src/sidebar/types";
import {
  createDefaultSidebarState,
  toggleVisibility,
  reorderItem,
  resetToDefaults,
  mergeNewPlugins,
  getVisibleItems,
  getAllItems,
} from "../../../src/sidebar/sidebarManager";
import {
  serializeSidebarState,
  deserializeSidebarState,
} from "../../../src/sidebar/sidebarPersistor";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const coreViews: readonly ViewRegistration[] = [
  { id: "dashboard", pluginId: "norbert-core", label: "Dashboard", icon: "layout-dashboard", primaryView: true, minWidth: 300, minHeight: 200, floatMetric: null },
  { id: "sessions", pluginId: "norbert-session", label: "Sessions", icon: "list", primaryView: false, minWidth: 200, minHeight: 100, floatMetric: null },
  { id: "agents", pluginId: "norbert-agents", label: "Agents", icon: "bot", primaryView: false, minWidth: 200, minHeight: 100, floatMetric: null },
  { id: "notifications", pluginId: "norbert-core", label: "Notifications", icon: "bell", primaryView: false, minWidth: 200, minHeight: 100, floatMetric: null },
  { id: "settings", pluginId: "norbert-core", label: "Settings", icon: "settings", primaryView: false, minWidth: 200, minHeight: 100, floatMetric: null },
];

const bottomPinnedIds = ["notifications", "settings"];

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Visibility
// ---------------------------------------------------------------------------

describe("Toggle sidebar icon visibility via right-click", () => {
  it("unchecking an icon removes it from the sidebar", () => {
    // GIVEN: all default sidebar icons are visible
    const state = createDefaultSidebarState(coreViews, bottomPinnedIds);

    // WHEN: the user unchecks "Agents" in the toggle list
    const updated = toggleVisibility(state, "agents");

    // THEN: the Agents icon disappears from the visible sidebar
    const visibleItems = getVisibleItems(updated);
    expect(visibleItems.find(item => item.id === "agents")).toBeUndefined();

    // AND: Agents still exists in the full item list (just hidden)
    const allItems = getAllItems(updated);
    const agentsItem = allItems.find(item => item.id === "agents");
    expect(agentsItem).toBeDefined();
    expect(agentsItem!.visible).toBe(false);
  });
});

describe("Right-click shows full section toggle list with checkmarks", () => {
  it("context menu lists all sections with visibility indicators", () => {
    // GIVEN: the user has some icons visible and some hidden
    const state = createDefaultSidebarState(coreViews, bottomPinnedIds);
    const withHidden = toggleVisibility(state, "agents");

    // WHEN: the user right-clicks any sidebar icon (getAllItems = toggle list)
    const toggleList = getAllItems(withHidden);

    // THEN: the full list of sections is returned
    expect(toggleList).toHaveLength(5);

    // AND: visible sections have visible=true
    const dashboard = toggleList.find(item => item.id === "dashboard");
    expect(dashboard!.visible).toBe(true);

    // AND: hidden sections have visible=false
    const agents = toggleList.find(item => item.id === "agents");
    expect(agents!.visible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Reorder
// ---------------------------------------------------------------------------

describe("Drag sidebar icons to reorder", () => {
  it("dragging an icon above another changes display order", () => {
    // GIVEN: default sidebar order
    const state = createDefaultSidebarState(coreViews, bottomPinnedIds);

    // WHEN: the user drags Sessions to position 0 (above Dashboard)
    const updated = reorderItem(state, "sessions", 0);

    // THEN: Sessions appears first in the visible sidebar
    const visibleItems = getVisibleItems(updated);
    expect(visibleItems[0].id).toBe("sessions");
    expect(visibleItems[1].id).toBe("dashboard");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Command Palette Fallback
// ---------------------------------------------------------------------------

describe("Hidden sections accessible via command palette", () => {
  it("hidden section opens in Main zone without changing sidebar visibility", () => {
    // GIVEN: the user has hidden the Agents sidebar icon
    const state = createDefaultSidebarState(coreViews, bottomPinnedIds);
    const withHidden = toggleVisibility(state, "agents");

    // WHEN: command palette accesses hidden items (getAllItems includes hidden)
    const allItems = getAllItems(withHidden);
    const agents = allItems.find(item => item.id === "agents");

    // THEN: Agents is still in the full list (accessible for command palette)
    expect(agents).toBeDefined();

    // AND: the Agents sidebar icon remains hidden
    expect(agents!.visible).toBe(false);

    // AND: visibility is not changed by accessing the list
    const visibleAfter = getVisibleItems(withHidden);
    expect(visibleAfter.find(item => item.id === "agents")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Reset sidebar to defaults", () => {
  it("all icons return to default visibility and order", () => {
    // GIVEN: the user has hidden 3 sidebar icons and reordered the rest
    let state = createDefaultSidebarState(coreViews, bottomPinnedIds);
    state = toggleVisibility(state, "agents");
    state = toggleVisibility(state, "sessions");
    state = toggleVisibility(state, "dashboard");
    state = reorderItem(state, "notifications", 0);

    // WHEN: the user resets the sidebar
    const reset = resetToDefaults(coreViews, bottomPinnedIds);

    // THEN: all icons return to default visibility and order
    const visibleItems = getVisibleItems(reset);
    expect(visibleItems).toHaveLength(5);
    expect(visibleItems[0].id).toBe("dashboard");
    expect(visibleItems[1].id).toBe("sessions");
    expect(visibleItems[2].id).toBe("agents");
  });
});

describe("Newly installed plugin appears at end of sidebar", () => {
  it("new plugin icon appends without disrupting existing order", () => {
    // GIVEN: the user has a customized sidebar order
    let state = createDefaultSidebarState(coreViews, bottomPinnedIds);
    state = reorderItem(state, "sessions", 0);

    // WHEN: a new plugin "norbert-usage" is installed
    const newViews: readonly ViewRegistration[] = [
      ...coreViews,
      { id: "usage", pluginId: "norbert-usage", label: "Usage", icon: "bar-chart", primaryView: false, minWidth: 200, minHeight: 100, floatMetric: null },
    ];
    const merged = mergeNewPlugins(state, newViews, bottomPinnedIds);

    // THEN: its sidebar icon appears at the end (before bottom-pinned items)
    const visibleItems = getVisibleItems(merged);
    const unpinnedItems = visibleItems.filter(item => item.pinned === "none");
    const lastUnpinned = unpinnedItems[unpinnedItems.length - 1];
    expect(lastUnpinned.id).toBe("usage");

    // AND: existing icon order is not disrupted
    expect(visibleItems[0].id).toBe("sessions");
    expect(visibleItems[1].id).toBe("dashboard");
  });
});

describe("Bottom-pinned items always remain at bottom", () => {
  it("reordering does not move Notifications or Settings from bottom", () => {
    // GIVEN: the sidebar has Notifications and Settings pinned at the bottom
    const state = createDefaultSidebarState(coreViews, bottomPinnedIds);

    // WHEN: the user reorders other icons
    const reordered = reorderItem(state, "agents", 0);

    // THEN: Notifications and Settings remain at the bottom
    const visibleItems = getVisibleItems(reordered);
    const lastTwo = visibleItems.slice(-2);
    expect(lastTwo[0].id).toBe("notifications");
    expect(lastTwo[1].id).toBe("settings");
  });
});

describe("Sidebar state survives app restart", () => {
  it("custom visibility and order persist across restart", () => {
    // GIVEN: the user has customized sidebar visibility and order
    let state = createDefaultSidebarState(coreViews, bottomPinnedIds);
    state = toggleVisibility(state, "agents");
    state = reorderItem(state, "sessions", 0);

    // WHEN: the state is serialized and deserialized (simulating restart)
    const serialized = serializeSidebarState(state);
    const restored = deserializeSidebarState(serialized);

    // THEN: the sidebar shows the same custom visibility and order
    expect(getVisibleItems(restored)).toEqual(getVisibleItems(state));
    expect(getAllItems(restored)).toEqual(getAllItems(state));
  });
});
