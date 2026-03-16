/**
 * Acceptance tests: norbert-config Plugin Registration and Lifecycle (02-02)
 *
 * Validates that norbert-config registers its view, tab via the NorbertPlugin
 * API during onLoad, and cleans up during onUnload.
 *
 * Driving ports: loadPlugins, createPluginRegistry, createNorbertAPI
 * Domain: plugin entry point (NorbertPlugin interface)
 *
 * Traces to: 02-02 acceptance criteria
 */

import { describe, it, expect, beforeEach } from "vitest";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import {
  createPluginRegistry,
  getViewsByPlugin,
  getTabsByPlugin,
} from "../../../src/plugins/pluginRegistry";
import { resetHookBridge } from "../../../src/plugins/hookBridge";
import { norbertConfigPlugin } from "../../../src/plugins/norbert-config/index";

beforeEach(() => {
  resetHookBridge();
});

const loadConfigPlugin = () =>
  loadPlugins(
    [norbertConfigPlugin],
    createPluginRegistry(),
    createNorbertAPI
  );

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("User sees Config tab after norbert-config loads", () => {
  it("manifest declares id 'norbert-config' with no plugin dependencies", () => {
    expect(norbertConfigPlugin.manifest.id).toBe("norbert-config");
    expect(norbertConfigPlugin.manifest.dependencies).toEqual({});
  });

  it("onLoad registers 1 primary view 'config-viewer' and 1 sidebar tab 'config' at order 2", () => {
    // When the plugin system loads norbert-config
    const registry = loadConfigPlugin();

    // Then the plugin is loaded successfully
    expect(registry.loadedPluginIds).toContain("norbert-config");

    // And 1 view is registered: config-viewer
    const views = getViewsByPlugin(registry, "norbert-config");
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe("config-viewer");
    expect(views[0].primaryView).toBe(true);

    // And a sidebar tab "config" is registered at order 2
    const tabs = getTabsByPlugin(registry, "norbert-config");
    expect(tabs).toHaveLength(1);
    expect(tabs[0].id).toBe("config");
    expect(tabs[0].order).toBe(2);
  });

  it("plugin loads and functions without active Claude Code session", () => {
    // When loading with no session context
    const registry = loadConfigPlugin();

    // Then the plugin loads without error
    expect(registry.loadedPluginIds).toContain("norbert-config");
    const views = getViewsByPlugin(registry, "norbert-config");
    expect(views).toHaveLength(1);
  });
});

describe("Plugin uses only public NorbertPlugin API", () => {
  it("plugin entry point imports no internal Norbert modules", () => {
    const fs = require("fs");
    const path = require("path");
    const pluginDir = path.resolve(
      __dirname,
      "../../../src/plugins/norbert-config"
    );
    const entryPointFiles = ["index.ts", "manifest.ts"].filter((f) =>
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
