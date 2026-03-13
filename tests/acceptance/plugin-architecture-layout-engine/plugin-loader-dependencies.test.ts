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
import { loadPlugins, disablePlugin } from "../../../src/plugins/lifecycleManager";
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
    const sessionIndex = resolution.value.loadOrder.indexOf("norbert-session");
    const usageIndex = resolution.value.loadOrder.indexOf("norbert-usage");
    expect(sessionIndex).toBeLessThan(usageIndex);

    // AND: loading in resolved order, both register views successfully
    const orderedPlugins = resolution.value.loadOrder.map(
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

    const orderedPlugins = resolution.value.loadOrder.map(
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
  it("dependent plugin loads with warning and greyed-out placeholders", () => {
    // GIVEN: norbert-usage depends on norbert-notif
    const notifPlugin = createMinimalPlugin("norbert-notif", "1.0.0");
    const usagePlugin = createMinimalPlugin("norbert-usage", "1.0.0", {
      "norbert-notif": "^1.0.0",
    });

    // AND: norbert-notif is installed but disabled by the user
    const scanned = scanPlugins([usagePlugin, notifPlugin]);
    const disabledPluginIds = new Set(["norbert-notif"]);

    // WHEN: dependency resolution occurs with disabled plugins
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest),
      disabledPluginIds
    );

    // THEN: resolution succeeds (disabled != missing)
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    // AND: degradation warnings are produced
    expect(resolution.value.degradationWarnings).toHaveLength(1);
    const warning = resolution.value.degradationWarnings[0];

    // AND: the warning states the disabled dependency
    expect(warning.pluginId).toBe("norbert-usage");
    expect(warning.disabledDependency).toBe("norbert-notif");
    expect(warning.message).toContain("norbert-notif");
    expect(warning.message).toContain("disabled");

    // AND: the warning includes a re-enable action
    expect(warning.reEnableAction).toBe("norbert-notif");

    // AND: norbert-usage loads successfully (only non-disabled plugins load)
    const activePlugins = resolution.value.loadOrder
      .filter((id) => !disabledPluginIds.has(id))
      .map((id) => scanned.find((p) => p.manifest.id === id)!);
    const registry = loadPlugins(
      activePlugins,
      createPluginRegistry(),
      createNorbertAPI
    );
    expect(registry.loadedPluginIds).toContain("norbert-usage");
    expect(registry.loadedPluginIds).not.toContain("norbert-notif");
  });
});

describe("Runtime dependency disable triggers graceful degradation", () => {
  it("disabling dependency mid-session shows placeholders without crash", () => {
    // GIVEN: norbert-usage is running and depends on norbert-notif
    const notifPlugin = createMinimalPlugin("norbert-notif", "1.0.0");
    const usagePlugin = createMinimalPlugin("norbert-usage", "1.0.0", {
      "norbert-notif": "^1.0.0",
    });

    const scanned = scanPlugins([notifPlugin, usagePlugin]);
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest)
    );
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    // Load all plugins initially
    const orderedPlugins = resolution.value.loadOrder.map(
      (id) => scanned.find((p) => p.manifest.id === id)!
    );
    const registry = loadPlugins(
      orderedPlugins,
      createPluginRegistry(),
      createNorbertAPI
    );
    expect(registry.loadedPluginIds).toContain("norbert-notif");
    expect(registry.loadedPluginIds).toContain("norbert-usage");

    // WHEN: the user disables norbert-notif mid-session
    const disableResult = disablePlugin(registry, "norbert-notif", scanned);

    // THEN: the operation succeeds without crash
    expect(disableResult.ok).toBe(true);
    if (!disableResult.ok) return;

    // AND: norbert-notif is removed from loaded plugins
    expect(disableResult.value.registry.loadedPluginIds).not.toContain("norbert-notif");

    // AND: norbert-usage continues to be loaded (non-notif features still work)
    expect(disableResult.value.registry.loadedPluginIds).toContain("norbert-usage");

    // AND: degradation warnings are produced for affected dependents
    expect(disableResult.value.degradationWarnings).toHaveLength(1);
    expect(disableResult.value.degradationWarnings[0].pluginId).toBe("norbert-usage");
    expect(disableResult.value.degradationWarnings[0].disabledDependency).toBe("norbert-notif");
  });
});

describe("Greyed-out placeholders include one-click re-enable path", () => {
  it("degraded features include re-enable action for each disabled dependency", () => {
    // GIVEN: norbert-notif is disabled
    const notifPlugin = createMinimalPlugin("norbert-notif", "1.0.0");
    const usagePlugin = createMinimalPlugin("norbert-usage", "1.0.0", {
      "norbert-notif": "^1.0.0",
    });

    const scanned = scanPlugins([usagePlugin, notifPlugin]);
    const disabledPluginIds = new Set(["norbert-notif"]);

    // WHEN: dependency resolution occurs with disabled plugins
    const resolution = resolveDependencies(
      scanned.map((p) => p.manifest),
      disabledPluginIds
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    // THEN: each degradation warning includes the re-enable action
    // pointing to the disabled dependency that can be re-enabled
    const warning = resolution.value.degradationWarnings[0];
    expect(warning.reEnableAction).toBe("norbert-notif");

    // AND: the warning message provides user-actionable information
    expect(warning.message).toMatch(/re-enable/i);
  });
});
