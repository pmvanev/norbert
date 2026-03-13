/**
 * Unit tests: Plugin Registry
 *
 * Validates that the plugin registry is an immutable data structure
 * that supports adding views, tabs, and querying by plugin.
 */

import { describe, it, expect } from "vitest";
import {
  createPluginRegistry,
  addView,
  addTab,
  markPluginLoaded,
  registerPublicAPI,
  getPublicAPI,
  getViewsByPlugin,
  getTabsByPlugin,
  getAllViews,
  getAllTabs,
} from "../../../src/plugins/pluginRegistry";
import type {
  ViewRegistration,
  TabRegistration,
  PluginPublicAPI,
  PluginRegistry,
} from "../../../src/plugins/types";

describe("createPluginRegistry", () => {
  it("creates an empty registry with no views, tabs, or loaded plugins", () => {
    const registry = createPluginRegistry();

    expect(registry.views).toEqual([]);
    expect(registry.tabs).toEqual([]);
    expect(registry.loadedPluginIds).toEqual([]);
  });
});

describe("addView", () => {
  it("returns a new registry with the view added", () => {
    const registry = createPluginRegistry();
    const view: ViewRegistration = {
      id: "team-dashboard",
      pluginId: "team-monitor",
      label: "Team Dashboard",
      icon: "users",
      primaryView: true,
      minWidth: 300,
      minHeight: 200,
      floatMetric: null,
    };

    const updated = addView(registry, view);

    expect(updated.views).toHaveLength(1);
    expect(updated.views[0]).toEqual(view);
  });

  it("does not mutate the original registry", () => {
    const registry = createPluginRegistry();
    const view: ViewRegistration = {
      id: "test-view",
      pluginId: "test-plugin",
      label: "Test",
      icon: "test",
      primaryView: false,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    };

    addView(registry, view);

    expect(registry.views).toHaveLength(0);
  });
});

describe("addTab", () => {
  it("returns a new registry with the tab added", () => {
    const registry = createPluginRegistry();
    const tab: TabRegistration = {
      id: "sessions-tab",
      pluginId: "norbert-session",
      icon: "list",
      label: "Sessions",
      order: 1,
    };

    const updated = addTab(registry, tab);

    expect(updated.tabs).toHaveLength(1);
    expect(updated.tabs[0]).toEqual(tab);
  });

  it("does not mutate the original registry", () => {
    const registry = createPluginRegistry();
    const tab: TabRegistration = {
      id: "test-tab",
      pluginId: "test",
      icon: "x",
      label: "Test",
      order: 1,
    };

    addTab(registry, tab);

    expect(registry.tabs).toHaveLength(0);
  });
});

describe("markPluginLoaded", () => {
  it("adds the plugin id to loadedPluginIds", () => {
    const registry = createPluginRegistry();

    const updated = markPluginLoaded(registry, "team-monitor");

    expect(updated.loadedPluginIds).toContain("team-monitor");
  });
});

describe("getViewsByPlugin", () => {
  it("returns only views belonging to the specified plugin", () => {
    let registry = createPluginRegistry();
    registry = addView(registry, {
      id: "v1",
      pluginId: "plugin-a",
      label: "View A",
      icon: "a",
      primaryView: true,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    });
    registry = addView(registry, {
      id: "v2",
      pluginId: "plugin-b",
      label: "View B",
      icon: "b",
      primaryView: false,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    });

    const viewsA = getViewsByPlugin(registry, "plugin-a");
    expect(viewsA).toHaveLength(1);
    expect(viewsA[0].id).toBe("v1");
  });
});

describe("getTabsByPlugin", () => {
  it("returns only tabs belonging to the specified plugin", () => {
    let registry = createPluginRegistry();
    registry = addTab(registry, {
      id: "t1",
      pluginId: "plugin-a",
      icon: "a",
      label: "Tab A",
      order: 1,
    });
    registry = addTab(registry, {
      id: "t2",
      pluginId: "plugin-b",
      icon: "b",
      label: "Tab B",
      order: 2,
    });

    const tabsB = getTabsByPlugin(registry, "plugin-b");
    expect(tabsB).toHaveLength(1);
    expect(tabsB[0].id).toBe("t2");
  });
});

describe("getAllViews", () => {
  it("returns all views from all plugins", () => {
    let registry = createPluginRegistry();
    registry = addView(registry, {
      id: "v1",
      pluginId: "plugin-a",
      label: "A",
      icon: "a",
      primaryView: true,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    });
    registry = addView(registry, {
      id: "v2",
      pluginId: "plugin-b",
      label: "B",
      icon: "b",
      primaryView: false,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    });

    expect(getAllViews(registry)).toHaveLength(2);
  });
});

describe("getAllTabs", () => {
  it("returns all tabs from all plugins", () => {
    let registry = createPluginRegistry();
    registry = addTab(registry, {
      id: "t1",
      pluginId: "p1",
      icon: "a",
      label: "A",
      order: 1,
    });
    registry = addTab(registry, {
      id: "t2",
      pluginId: "p2",
      icon: "b",
      label: "B",
      order: 2,
    });

    expect(getAllTabs(registry)).toHaveLength(2);
  });
});

describe("registerPublicAPI", () => {
  it("returns a new registry with the plugin's public API stored", () => {
    const registry = createPluginRegistry();
    const publicAPI: PluginPublicAPI = {
      getSessionById: (id: string) => ({ id }),
    };

    const updated = registerPublicAPI(registry, "norbert-session", publicAPI);

    expect(getPublicAPI(updated, "norbert-session")).toBe(publicAPI);
  });

  it("does not mutate the original registry", () => {
    const registry = createPluginRegistry();
    const publicAPI: PluginPublicAPI = { getValue: () => 42 };

    registerPublicAPI(registry, "test-plugin", publicAPI);

    expect(getPublicAPI(registry, "test-plugin")).toBeUndefined();
  });
});

describe("getPublicAPI", () => {
  it("returns undefined for a plugin with no registered public API", () => {
    const registry = createPluginRegistry();

    expect(getPublicAPI(registry, "nonexistent")).toBeUndefined();
  });
});
