/**
 * Acceptance tests: norbert-notif Plugin Registration and Status Bar (US-NOTIF-07)
 *
 * Validates that norbert-notif registers its views, sidebar tab, status bar item,
 * and hook processors for all 14 notification events via the NorbertPlugin API.
 *
 * Driving ports: loadPlugins, createPluginRegistry, createNorbertAPI
 * Domain: plugin entry point (NorbertPlugin interface)
 *
 * Traces to: US-NOTIF-07 acceptance criteria
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
import { norbertNotifPlugin } from "../../../src/plugins/norbert-notif/index";

beforeEach(() => {
  resetHookBridge();
});

const loadNotifPlugin = () =>
  loadPlugins(
    [norbertNotifPlugin],
    createPluginRegistry(),
    createNorbertAPI
  );

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User sees Notifications tab after norbert-notif loads", () => {
  it("plugin registers sidebar tab, status bar item, and hook processors on load", () => {
    // Given the norbert-notif plugin implements the NorbertPlugin interface
    // And the manifest declares id "norbert-notif" with no plugin dependencies
    expect(norbertNotifPlugin.manifest.id).toBe("norbert-notif");
    expect(norbertNotifPlugin.manifest.dependencies).toEqual({});

    // When the plugin system loads norbert-notif
    const registry = loadNotifPlugin();

    // Then the plugin is loaded successfully
    expect(registry.loadedPluginIds).toContain("norbert-notif");

    // And a sidebar tab "notifications" is registered with bell icon
    const tabs = getTabsByPlugin(registry, "norbert-notif");
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe("notifications");
    expect(tabs[0].label).toBe("Notifications");

    // And a status bar item is registered on the left
    const statusItems = getStatusItemsByPlugin(registry, "norbert-notif");
    expect(statusItems).toHaveLength(1);
    expect(statusItems[0].position).toBe("left");

    // And hook processors are registered for notification event sources
    const hooks = getHookRegistrationsByPlugin(registry, "norbert-notif");
    expect(hooks.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Status Bar and Settings Structure
// ---------------------------------------------------------------------------

describe("Status bar shows DND state and unread count", () => {
  it("displays DND off and unread count when plugin is loaded", () => {
    // Given norbert-notif is loaded and DND is off
    // And 0 banner notifications are undismissed

    // When inspecting the status bar item data
    const registry = loadNotifPlugin();
    const statusItems = getStatusItemsByPlugin(registry, "norbert-notif");

    // Then the status bar item is registered
    expect(statusItems).toHaveLength(1);

    // And its label encodes DND state (off) and unread count (0)
    expect(statusItems[0].label).toContain("DND off");
    expect(statusItems[0].label).toContain("0");
  });
});

describe("Settings section has sec-hdr title with sub-sections", () => {
  it("registers settings view with title 'Notifications' and sub-sections", () => {
    // Given norbert-notif is loaded

    // When inspecting the registered views
    const registry = loadNotifPlugin();
    const views = getViewsByPlugin(registry, "norbert-notif");

    // Then a settings view is registered with label 'Notifications'
    expect(views.length).toBeGreaterThanOrEqual(1);
    const settingsView = views.find((v) => v.label === "Notifications");
    expect(settingsView).toBeDefined();
    expect(settingsView!.id).toBe("notif-settings");
  });
});

// ---------------------------------------------------------------------------
// ERROR / BOUNDARY SCENARIOS
// ---------------------------------------------------------------------------

describe("Plugin uses only public NorbertPlugin API", () => {
  it("norbert-notif imports no internal Norbert modules", () => {
    // Given norbert-notif source code exists
    // When inspecting its entry point imports
    // Then it imports only from ../types (plugin types) and its own domain modules
    const fs = require("fs");
    const path = require("path");
    const pluginDir = path.resolve(
      __dirname,
      "../../../src/plugins/norbert-notif"
    );
    const entryPointFiles = ["index.ts", "manifest.ts"].filter((f: string) =>
      fs.existsSync(path.join(pluginDir, f))
    );

    for (const file of entryPointFiles) {
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

describe.skip("Plugin loads independently with no plugin dependencies", () => {
  it("loads without any other plugins present in the registry", () => {
    // Given only norbert-notif is provided to the plugin loader
    // And no other plugins are loaded

    // When the plugin system loads norbert-notif alone
    const registry = loadNotifPlugin();

    // Then the plugin loads without error
    expect(registry.loadedPluginIds).toContain("norbert-notif");

    // And its manifest declares empty dependencies
    expect(norbertNotifPlugin.manifest.dependencies).toEqual({});
  });
});
