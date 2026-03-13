/**
 * Unit tests: Lifecycle Manager
 *
 * Validates that loadPlugins calls onLoad for each plugin with a scoped API,
 * and that the resulting registry contains all registered views and tabs.
 * Also validates disablePlugin for runtime disable with graceful degradation.
 */

import { describe, it, expect } from "vitest";
import { loadPlugins, disablePlugin } from "../../../src/plugins/lifecycleManager";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import { createPluginRegistry } from "../../../src/plugins/pluginRegistry";
import type {
  NorbertPlugin,
  PluginRegistry,
} from "../../../src/plugins/types";

// ---------------------------------------------------------------------------
// Helper: create a minimal plugin
// ---------------------------------------------------------------------------

const createTestPlugin = (
  id: string,
  dependencies: Readonly<Record<string, string>> = {},
  onLoad: NorbertPlugin["onLoad"] = () => {}
): NorbertPlugin => ({
  manifest: {
    id,
    name: id,
    version: "1.0.0",
    norbert_api: "^1.0.0",
    dependencies,
  },
  onLoad,
  onUnload: () => {},
});

describe("loadPlugins", () => {
  it("calls onLoad for each plugin and collects view registrations", () => {
    const plugin: NorbertPlugin = {
      manifest: {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.ui.registerView({
          id: "test-view",
          label: "Test View",
          icon: "test",
          primaryView: true,
          minWidth: 200,
          minHeight: 100,
          floatMetric: null,
        });
      },
      onUnload: () => {},
    };

    const registry = loadPlugins(
      [plugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    expect(registry.views).toHaveLength(1);
    expect(registry.views[0].id).toBe("test-view");
    expect(registry.views[0].pluginId).toBe("test-plugin");
  });

  it("calls onLoad for each plugin and collects tab registrations", () => {
    const plugin: NorbertPlugin = {
      manifest: {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.ui.registerTab({
          id: "test-tab",
          icon: "test",
          label: "Test Tab",
          order: 1,
        });
      },
      onUnload: () => {},
    };

    const registry = loadPlugins(
      [plugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    expect(registry.tabs).toHaveLength(1);
    expect(registry.tabs[0].pluginId).toBe("test-plugin");
  });

  it("marks each loaded plugin in the registry", () => {
    const pluginA: NorbertPlugin = {
      manifest: {
        id: "plugin-a",
        name: "A",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: () => {},
      onUnload: () => {},
    };
    const pluginB: NorbertPlugin = {
      manifest: {
        id: "plugin-b",
        name: "B",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: () => {},
      onUnload: () => {},
    };

    const registry = loadPlugins(
      [pluginA, pluginB],
      createPluginRegistry(),
      createNorbertAPI
    );

    expect(registry.loadedPluginIds).toContain("plugin-a");
    expect(registry.loadedPluginIds).toContain("plugin-b");
  });

  it("returns empty registry when no plugins provided", () => {
    const registry = loadPlugins(
      [],
      createPluginRegistry(),
      createNorbertAPI
    );

    expect(registry.views).toEqual([]);
    expect(registry.tabs).toEqual([]);
    expect(registry.loadedPluginIds).toEqual([]);
  });

  it("aggregates registrations from multiple plugins", () => {
    const pluginA: NorbertPlugin = {
      manifest: {
        id: "plugin-a",
        name: "A",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.ui.registerView({
          id: "view-a",
          label: "View A",
          icon: "a",
          primaryView: true,
          minWidth: 200,
          minHeight: 100,
          floatMetric: null,
        });
      },
      onUnload: () => {},
    };
    const pluginB: NorbertPlugin = {
      manifest: {
        id: "plugin-b",
        name: "B",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.ui.registerView({
          id: "view-b",
          label: "View B",
          icon: "b",
          primaryView: false,
          minWidth: 200,
          minHeight: 100,
          floatMetric: "metric",
        });
      },
      onUnload: () => {},
    };

    const registry = loadPlugins(
      [pluginA, pluginB],
      createPluginRegistry(),
      createNorbertAPI
    );

    expect(registry.views).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Runtime disable
// ---------------------------------------------------------------------------

describe("disablePlugin — runtime graceful degradation", () => {
  it("removes disabled plugin from loadedPluginIds", () => {
    const provider = createTestPlugin("provider");
    const consumer = createTestPlugin("consumer", { provider: "^1.0.0" });

    const registry = loadPlugins(
      [provider, consumer],
      createPluginRegistry(),
      createNorbertAPI
    );

    const result = disablePlugin(registry, "provider", [provider, consumer]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.registry.loadedPluginIds).not.toContain("provider");
  });

  it("keeps dependent plugins loaded", () => {
    const provider = createTestPlugin("provider");
    const consumer = createTestPlugin("consumer", { provider: "^1.0.0" });

    const registry = loadPlugins(
      [provider, consumer],
      createPluginRegistry(),
      createNorbertAPI
    );

    const result = disablePlugin(registry, "provider", [provider, consumer]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.registry.loadedPluginIds).toContain("consumer");
  });

  it("produces degradation warnings for affected dependents", () => {
    const provider = createTestPlugin("provider");
    const consumer = createTestPlugin("consumer", { provider: "^1.0.0" });

    const registry = loadPlugins(
      [provider, consumer],
      createPluginRegistry(),
      createNorbertAPI
    );

    const result = disablePlugin(registry, "provider", [provider, consumer]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.degradationWarnings).toHaveLength(1);
    expect(result.value.degradationWarnings[0].pluginId).toBe("consumer");
    expect(result.value.degradationWarnings[0].disabledDependency).toBe("provider");
    expect(result.value.degradationWarnings[0].reEnableAction).toBe("provider");
  });

  it("returns error when plugin is not loaded", () => {
    const registry = createPluginRegistry();

    const result = disablePlugin(registry, "nonexistent", []);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("nonexistent");
  });
});
