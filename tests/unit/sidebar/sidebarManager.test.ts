/**
 * Unit tests: Sidebar Manager — pure functions for sidebar state management
 *
 * Properties and examples for: createDefaultSidebarState, toggleVisibility,
 * reorderItem, resetToDefaults, mergeNewPlugins, getVisibleItems, getAllItems.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type { ViewRegistration } from "../../../src/plugins/types";
import type { SidebarItem, SidebarState } from "../../../src/sidebar/types";
import {
  createDefaultSidebarState,
  toggleVisibility,
  reorderItem,
  resetToDefaults,
  mergeNewPlugins,
  getVisibleItems,
  getAllItems,
} from "../../../src/sidebar/sidebarManager";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const makeView = (id: string, pluginId: string, label: string, icon: string): ViewRegistration => ({
  id,
  pluginId,
  label,
  icon,
  primaryView: false,
  minWidth: 200,
  minHeight: 100,
  floatMetric: null,
});

const testViews: readonly ViewRegistration[] = [
  makeView("dashboard", "core", "Dashboard", "layout-dashboard"),
  makeView("sessions", "session", "Sessions", "list"),
  makeView("agents", "agents", "Agents", "bot"),
  makeView("notifications", "core", "Notifications", "bell"),
  makeView("settings", "core", "Settings", "settings"),
];

const pinnedIds = ["notifications", "settings"];

// ---------------------------------------------------------------------------
// createDefaultSidebarState
// ---------------------------------------------------------------------------

describe("createDefaultSidebarState", () => {
  it("creates one SidebarItem per ViewRegistration", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    expect(state.items).toHaveLength(testViews.length);
  });

  it("all items are visible by default", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    expect(state.items.every(item => item.visible)).toBe(true);
  });

  it("marks bottom-pinned items correctly", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const notifications = state.items.find(i => i.id === "notifications");
    const settings = state.items.find(i => i.id === "settings");
    expect(notifications!.pinned).toBe("bottom");
    expect(settings!.pinned).toBe("bottom");
  });

  it("non-pinned items have pinned='none'", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const dashboard = state.items.find(i => i.id === "dashboard");
    expect(dashboard!.pinned).toBe("none");
  });

  it("preserves order from input views with order indices", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    for (let i = 0; i < state.items.length; i++) {
      expect(state.items[i].order).toBe(i);
    }
  });
});

// ---------------------------------------------------------------------------
// toggleVisibility
// ---------------------------------------------------------------------------

describe("toggleVisibility", () => {
  it("hides a visible item", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const updated = toggleVisibility(state, "agents");
    const agents = updated.items.find(i => i.id === "agents");
    expect(agents!.visible).toBe(false);
  });

  it("shows a hidden item", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const hidden = toggleVisibility(state, "agents");
    const shown = toggleVisibility(hidden, "agents");
    const agents = shown.items.find(i => i.id === "agents");
    expect(agents!.visible).toBe(true);
  });

  it("does not mutate original state", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    toggleVisibility(state, "agents");
    expect(state.items.find(i => i.id === "agents")!.visible).toBe(true);
  });

  it("property: toggle twice returns to original visibility", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...testViews.map(v => v.id)),
        (itemId) => {
          const state = createDefaultSidebarState(testViews, pinnedIds);
          const toggledTwice = toggleVisibility(toggleVisibility(state, itemId), itemId);
          const original = state.items.find(i => i.id === itemId)!;
          const result = toggledTwice.items.find(i => i.id === itemId)!;
          expect(result.visible).toBe(original.visible);
        }
      )
    );
  });

  it("property: toggle preserves item count", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...testViews.map(v => v.id)),
        (itemId) => {
          const state = createDefaultSidebarState(testViews, pinnedIds);
          const updated = toggleVisibility(state, itemId);
          expect(updated.items.length).toBe(state.items.length);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// reorderItem
// ---------------------------------------------------------------------------

describe("reorderItem", () => {
  it("moves an item to a new position among unpinned items", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const updated = reorderItem(state, "sessions", 0);
    const visible = getVisibleItems(updated);
    expect(visible[0].id).toBe("sessions");
  });

  it("does not move bottom-pinned items out of the bottom", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const updated = reorderItem(state, "agents", 0);
    const visible = getVisibleItems(updated);
    const lastTwo = visible.slice(-2);
    expect(lastTwo.map(i => i.id)).toEqual(["notifications", "settings"]);
  });

  it("does not mutate original state", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const originalFirst = getVisibleItems(state)[0].id;
    reorderItem(state, "sessions", 0);
    expect(getVisibleItems(state)[0].id).toBe(originalFirst);
  });

  it("property: reorder preserves total item count", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...testViews.filter(v => !pinnedIds.includes(v.id)).map(v => v.id)),
        fc.integer({ min: 0, max: testViews.length - pinnedIds.length - 1 }),
        (itemId, newIndex) => {
          const state = createDefaultSidebarState(testViews, pinnedIds);
          const updated = reorderItem(state, itemId, newIndex);
          expect(updated.items.length).toBe(state.items.length);
        }
      )
    );
  });

  it("property: pinned items always at bottom after reorder", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...testViews.filter(v => !pinnedIds.includes(v.id)).map(v => v.id)),
        fc.integer({ min: 0, max: testViews.length - pinnedIds.length - 1 }),
        (itemId, newIndex) => {
          const state = createDefaultSidebarState(testViews, pinnedIds);
          const updated = reorderItem(state, itemId, newIndex);
          const visible = getVisibleItems(updated);
          const pinnedItems = visible.filter(i => i.pinned === "bottom");
          const lastN = visible.slice(-pinnedItems.length);
          expect(lastN.every(i => i.pinned === "bottom")).toBe(true);
        }
      )
    );
  });
});

// ---------------------------------------------------------------------------
// getVisibleItems / getAllItems
// ---------------------------------------------------------------------------

describe("getVisibleItems", () => {
  it("returns only visible items in order", () => {
    let state = createDefaultSidebarState(testViews, pinnedIds);
    state = toggleVisibility(state, "agents");
    const visible = getVisibleItems(state);
    expect(visible.every(i => i.visible)).toBe(true);
    expect(visible.find(i => i.id === "agents")).toBeUndefined();
  });
});

describe("getAllItems", () => {
  it("returns all items including hidden ones", () => {
    let state = createDefaultSidebarState(testViews, pinnedIds);
    state = toggleVisibility(state, "agents");
    const all = getAllItems(state);
    expect(all).toHaveLength(testViews.length);
    expect(all.find(i => i.id === "agents")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// resetToDefaults
// ---------------------------------------------------------------------------

describe("resetToDefaults", () => {
  it("produces same state as createDefaultSidebarState", () => {
    const defaults = createDefaultSidebarState(testViews, pinnedIds);
    const reset = resetToDefaults(testViews, pinnedIds);
    expect(reset).toEqual(defaults);
  });
});

// ---------------------------------------------------------------------------
// mergeNewPlugins
// ---------------------------------------------------------------------------

describe("mergeNewPlugins", () => {
  it("adds new plugins at the end before pinned items", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const extendedViews: readonly ViewRegistration[] = [
      ...testViews,
      makeView("usage", "norbert-usage", "Usage", "bar-chart"),
    ];
    const merged = mergeNewPlugins(state, extendedViews, pinnedIds);

    const visible = getVisibleItems(merged);
    const unpinned = visible.filter(i => i.pinned === "none");
    expect(unpinned[unpinned.length - 1].id).toBe("usage");
  });

  it("does not duplicate existing items", () => {
    const state = createDefaultSidebarState(testViews, pinnedIds);
    const merged = mergeNewPlugins(state, testViews, pinnedIds);
    expect(merged.items.length).toBe(state.items.length);
  });

  it("preserves existing order and visibility", () => {
    let state = createDefaultSidebarState(testViews, pinnedIds);
    state = toggleVisibility(state, "agents");
    state = reorderItem(state, "sessions", 0);

    const extendedViews: readonly ViewRegistration[] = [
      ...testViews,
      makeView("usage", "norbert-usage", "Usage", "bar-chart"),
    ];
    const merged = mergeNewPlugins(state, extendedViews, pinnedIds);

    // sessions should still be first among unpinned
    const unpinned = getVisibleItems(merged).filter(i => i.pinned === "none");
    expect(unpinned[0].id).toBe("sessions");

    // agents should still be hidden
    const agents = merged.items.find(i => i.id === "agents");
    expect(agents!.visible).toBe(false);
  });
});
