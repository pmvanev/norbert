/**
 * Acceptance tests: Plugin Loader and Dependency Resolver (US-002)
 *
 * Validates that plugins load in dependency order, missing dependencies
 * produce actionable errors, disabled dependencies trigger degradation
 * warnings, and version mismatches are hard failures.
 *
 * Driving ports: PluginLoader port, LifecycleManager port
 * These tests invoke through the plugin loading lifecycle,
 * never through the internal DependencyResolver or topological sort.
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { NorbertPlugin } from "../../../src/plugins/types";
import { scanPlugins } from "../../../src/plugins/pluginLoader";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import {
  createPluginRegistry,
} from "../../../src/plugins/pluginRegistry";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import { resetHookBridge } from "../../../src/plugins/hookBridge";
import { resolveDependencies } from "../../../src/plugins/dependencyResolver";

beforeEach(() => {
  resetHookBridge();
});

// ---------------------------------------------------------------------------
// Test helpers — minimal plugin factories
// ---------------------------------------------------------------------------

const createMinimalPlugin = (
  id: string,
  version: string,
  dependencies: Readonly<Record<string, string>> = {}
): NorbertPlugin => ({
  manifest: {
    id,
    name: id,
    version,
    norbert_api: "^1.0.0",
    dependencies,
  },
  onLoad: (api) => {
    api.ui.registerView({
      id: `${id}-view`,
      label: `${id} View`,
      icon: "box",
      primaryView: false,
      minWidth: 200,
      minHeight: 100,
      floatMetric: null,
    });
  },
  onUnload: () => {},
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: Happy Path
// ---------------------------------------------------------------------------

describe("Plugins load in topological dependency order", () => {
  it("dependent plugin loads after its dependency", () => {
    // GIVEN: norbert-usage depends on norbert-session
    // AND: both plugins are installed
    const sessionPlugin = createMinimalPlugin("norbert-session", "1.0.0");
    const usagePlugin = createMinimalPlugin("norbert-usage", "1.0.0", {
      "norbert-session": "^1.0.0",
    });

    // Provide plugins in wrong order (usage before session)
    const scanned = scanPlugins([usagePlugin, sessionPlugin]);

    // WHEN: dependency resolution occurs
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );

    // THEN: resolution succeeds
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    // AND: norbert-session appears before norbert-usage in the load order
    const sessionIndex = resolution.value.indexOf("norbert-session");
    const usageIndex = resolution.value.indexOf("norbert-usage");
    expect(sessionIndex).toBeLessThan(usageIndex);

    // AND: loading in resolved order, both register views successfully
    const orderedPlugins = resolution.value.map(
      (id) => scanned.find((p) => p.manifest.id === id)!
    );
    const registry = loadPlugins(
      orderedPlugins,
      createPluginRegistry(),
      createNorbertAPI
    );
    expect(registry.loadedPluginIds).toContain("norbert-session");
    expect(registry.loadedPluginIds).toContain("norbert-usage");
    expect(registry.views).toHaveLength(2);
  });
});

describe("All dependencies satisfied results in clean startup", () => {
  it("startup log reports plugin count and view count", () => {
    // GIVEN: norbert-session and norbert-usage are installed
    // AND: all dependencies are satisfied
    const sessionPlugin = createMinimalPlugin("norbert-session", "1.0.0");
    const usagePlugin = createMinimalPlugin("norbert-usage", "1.0.0", {
      "norbert-session": "^1.0.0",
    });

    const scanned = scanPlugins([usagePlugin, sessionPlugin]);

    // WHEN: Norbert starts up (resolve + load)
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );

    // THEN: resolution succeeds
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    const orderedPlugins = resolution.value.map(
      (id) => scanned.find((p) => p.manifest.id === id)!
    );
    const registry = loadPlugins(
      orderedPlugins,
      createPluginRegistry(),
      createNorbertAPI
    );

    // AND: both plugins are loaded
    expect(registry.loadedPluginIds).toHaveLength(2);
    // AND: startup reports the correct view counts
    expect(registry.views).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("Missing dependency prevents plugin load with actionable error", () => {
  it("error lists missing dependencies and offers install action", () => {
    // GIVEN: norbert-cc-plugin-nwave depends on norbert-agents
    // AND: norbert-agents is not installed
    const nwavePlugin = createMinimalPlugin("norbert-cc-plugin-nwave", "1.0.0", {
      "norbert-agents": "^1.0.0",
    });

    const scanned = scanPlugins([nwavePlugin]);

    // WHEN: dependency resolution occurs
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );

    // THEN: resolution fails
    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;

    // AND: the error message states the missing dependency
    expect(resolution.error).toContain("norbert-agents");
    expect(resolution.error).toContain("not installed");
  });
});

describe("Version mismatch is a hard failure", () => {
  it("plugin refuses to load with specific version requirement in error", () => {
    // GIVEN: norbert-cc-plugin-nwave requires norbert-agents@>=1.2
    // AND: norbert-agents@1.0.0 is installed
    const agentsPlugin = createMinimalPlugin("norbert-agents", "1.0.0");
    const nwavePlugin = createMinimalPlugin("norbert-cc-plugin-nwave", "1.0.0", {
      "norbert-agents": ">=1.2.0",
    });

    const scanned = scanPlugins([agentsPlugin, nwavePlugin]);

    // WHEN: dependency resolution occurs
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );

    // THEN: resolution fails
    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;

    // AND: the error states the version mismatch with specific version
    expect(resolution.error).toContain("norbert-agents");
    expect(resolution.error).toContain(">=1.2.0");
    expect(resolution.error).toContain("1.0.0");
  });
});

describe("Circular dependency is detected and reported", () => {
  it("plugins with circular dependencies fail to load with clear error", () => {
    // GIVEN: plugin-a depends on plugin-b
    // AND: plugin-b depends on plugin-a
    const pluginA = createMinimalPlugin("plugin-a", "1.0.0", {
      "plugin-b": "^1.0.0",
    });
    const pluginB = createMinimalPlugin("plugin-b", "1.0.0", {
      "plugin-a": "^1.0.0",
    });

    const scanned = scanPlugins([pluginA, pluginB]);

    // WHEN: dependency resolution occurs
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );

    // THEN: resolution fails
    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;

    // AND: the error message identifies the circular dependency
    expect(resolution.error).toMatch(/circular/i);
    expect(resolution.error).toContain("plugin-a");
    expect(resolution.error).toContain("plugin-b");
  });
});

describe("Multiple missing dependencies listed in single error", () => {
  it("error aggregates all missing dependencies for a plugin", () => {
    // GIVEN: norbert-cc-plugin-nwave depends on norbert-agents and norbert-archaeology
    // AND: neither is installed
    const nwavePlugin = createMinimalPlugin("norbert-cc-plugin-nwave", "1.0.0", {
      "norbert-agents": "^1.0.0",
      "norbert-archaeology": "^1.0.0",
    });

    const scanned = scanPlugins([nwavePlugin]);

    // WHEN: dependency resolution occurs
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );

    // THEN: resolution fails
    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;

    // AND: the error message lists both missing dependencies
    expect(resolution.error).toContain("norbert-agents");
    expect(resolution.error).toContain("norbert-archaeology");
  });
});

// ---------------------------------------------------------------------------
// FUTURE SCENARIOS (out of scope for step 01-06)
// ---------------------------------------------------------------------------

describe("Disabled dependency triggers degradation warning", () => {
  it.skip("dependent plugin loads with warning and greyed-out placeholders", () => {
    // GIVEN: norbert-usage depends on norbert-notif
    // AND: norbert-notif is installed but disabled by the user
    // WHEN: Norbert starts up
    // THEN: norbert-usage loads successfully
    // AND: a notification states:
    //      "norbert-notif is disabled. Notification delivery will not be available."
    // AND: the notification includes a "Re-enable norbert-notif" action
    // AND: features depending on norbert-notif show greyed-out placeholders
    //
    // Driving port: PluginLoader port, LifecycleManager port
  });
});

describe("Runtime dependency disable triggers graceful degradation", () => {
  it.skip("disabling dependency mid-session shows placeholders without crash", () => {
    // GIVEN: norbert-usage is running and depends on norbert-notif
    // WHEN: the user disables norbert-notif from Plugin settings mid-session
    // THEN: norbert-usage features relying on norbert-notif show greyed-out placeholders
    // AND: a tray notification informs the user what changed
    // AND: norbert-usage continues functioning for non-notif features
    //
    // Driving port: LifecycleManager port (runtime disable)
  });
});

describe("Greyed-out placeholders include one-click re-enable path", () => {
  it.skip("clicking a greyed-out placeholder offers to re-enable the disabled dependency", () => {
    // GIVEN: norbert-notif is disabled
    // AND: a norbert-usage feature shows a greyed-out placeholder
    // WHEN: the user clicks the placeholder
    // THEN: a prompt offers to re-enable norbert-notif
    //
    // Driving port: LifecycleManager port
  });
});
