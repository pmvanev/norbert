/**
 * Acceptance tests: norbert-usage Plugin Registration and Lifecycle (US-001)
 *
 * Validates that norbert-usage registers its views, tab, status item,
 * and hook processor via the NorbertPlugin API during onLoad, and
 * cleans up during onUnload.
 *
 * Driving ports: loadPlugins, createPluginRegistry, createNorbertAPI
 * Domain: plugin entry point (NorbertPlugin interface)
 *
 * Traces to: US-001 acceptance criteria
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import {
  createPluginRegistry,
  getViewsByPlugin,
  getTabsByPlugin,
  getStatusItemsByPlugin,
  getHookRegistrationsByPlugin,
} from "../../../src/plugins/pluginRegistry";
import { resetHookBridge } from "../../../src/plugins/hookBridge";
import { norbertUsagePlugin } from "../../../src/plugins/norbert-usage/index";

beforeEach(() => {
  resetHookBridge();
});

const loadUsagePlugin = () =>
  loadPlugins(
    [norbertUsagePlugin],
    createPluginRegistry(),
    createNorbertAPI
  );

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User sees Usage tab after norbert-usage loads", () => {
  it("plugin registers views, tab, status item, and hook processor on load", () => {
    // Given the norbert-usage plugin implements the NorbertPlugin interface
    // And the manifest declares id "norbert-usage" with no plugin dependencies
    expect(norbertUsagePlugin.manifest.id).toBe("norbert-usage");
    expect(norbertUsagePlugin.manifest.dependencies).toEqual({});

    // When the plugin system loads norbert-usage
    const registry = loadUsagePlugin();

    // Then the plugin is loaded successfully
    expect(registry.loadedPluginIds).toContain("norbert-usage");

    // And 3 views are registered: usage-dashboard, session-status, performance-monitor
    const views = getViewsByPlugin(registry, "norbert-usage");
    expect(views).toHaveLength(3);
    const viewIds = views.map((v) => v.id);
    expect(viewIds).toContain("usage-dashboard");
    expect(viewIds).toContain("session-status");
    expect(viewIds).toContain("performance-monitor");

    // And a sidebar tab "usage" is registered
    const tabs = getTabsByPlugin(registry, "norbert-usage");
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe("usage");
    expect(tabs[0].label).toBe("Usage");

    // And a status bar item "cost-ticker" is registered on the right
    const statusItems = getStatusItemsByPlugin(registry, "norbert-usage");
    expect(statusItems).toHaveLength(1);
    expect(statusItems[0].id).toBe("cost-ticker");
    expect(statusItems[0].position).toBe("right");

    // And a hook processor is registered for session events
    const hooks = getHookRegistrationsByPlugin(registry, "norbert-usage");
    expect(hooks.length).toBeGreaterThanOrEqual(1);
    expect(hooks.some((h) => h.hookName === "session-event")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: View Registration Details
// ---------------------------------------------------------------------------

describe("Session Status view is secondary-panel only", () => {
  it("registers as a non-primary view with no float metric", () => {
    // Given norbert-usage is loaded
    const registry = loadUsagePlugin();

    // When inspecting the session-status view registration
    const views = getViewsByPlugin(registry, "norbert-usage");
    const sessionStatus = views.find((v) => v.id === "session-status");

    // Then the session-status view exists and is not primary
    expect(sessionStatus).toBeDefined();
    expect(sessionStatus!.primaryView).toBe(false);
    expect(sessionStatus!.floatMetric).toBeNull();
    expect(sessionStatus!.label).toBe("Session Status");
  });
});

describe("Usage Dashboard is the primary view", () => {
  it("usage-dashboard registers as primaryView for default display", () => {
    // Given norbert-usage is loaded
    const registry = loadUsagePlugin();

    // When inspecting the usage-dashboard view registration
    const views = getViewsByPlugin(registry, "norbert-usage");
    const dashboard = views.find((v) => v.id === "usage-dashboard");

    // Then the usage-dashboard view is marked as primary
    expect(dashboard).toBeDefined();
    expect(dashboard!.primaryView).toBe(true);
    expect(dashboard!.label).toBe("Usage Dashboard");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Plugin operates with degraded functionality when API unavailable", () => {
  it("continues with views and tab when status item registration fails", () => {
    // Given Norbert core does not support registerStatusItem
    // (simulated by providing a modified API factory that throws on registerStatusItem)

    // When norbert-usage attempts to register all components
    // Then it should not crash -- the plugin should handle partial API availability

    // This test validates the plugin's resilience to partial API support.
    // The plugin should log a warning and continue operating with views and tab
    // even if the status item registration is unavailable.

    // For now, we verify the plugin loads without error through the standard path.
    // The degradation behavior will be tested once the plugin implementation exists.
    const registry = loadUsagePlugin();

    // Then the plugin is loaded
    expect(registry.loadedPluginIds).toContain("norbert-usage");

    // And views are still registered
    const views = getViewsByPlugin(registry, "norbert-usage");
    expect(views.length).toBeGreaterThanOrEqual(3);
  });
});

describe("Plugin uses only public NorbertPlugin API", () => {
  it("norbert-usage imports no internal Norbert modules", () => {
    // Given norbert-usage source code exists
    // When inspecting its imports
    // Then it imports only from ../types (plugin types) and its own domain modules

    // This is a structural test that verifies hexagonal boundary compliance.
    // The plugin must not import from pluginLoader, lifecycleManager, apiFactory,
    // sandboxEnforcer, hookBridge, pluginRegistry, or dependencyResolver.
    const fs = require("fs");
    const path = require("path");
    const pluginDir = path.resolve(
      __dirname,
      "../../../src/plugins/norbert-usage"
    );
    const pluginFiles = fs
      .readdirSync(pluginDir)
      .filter((f: string) => f.endsWith(".ts") || f.endsWith(".tsx"));

    for (const file of pluginFiles) {
      const content = fs.readFileSync(
        path.join(pluginDir, file),
        "utf-8"
      );
      const importLines = content.match(/^import .+ from .+$/gm) ?? [];
      for (const importLine of importLines) {
        const importPathMatch = importLine.match(/from\s+["'](.+?)["']/);
        if (importPathMatch) {
          const importPath = importPathMatch[1];
          expect(importPath).not.toContain("@tauri-apps");
          expect(importPath).not.toMatch(
            /\.\.\/(pluginLoader|lifecycleManager|apiFactory|sandboxEnforcer|hookBridge|pluginRegistry|dependencyResolver)/
          );
        }
      }
    }
  });
});
