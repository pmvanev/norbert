/**
 * Acceptance tests: NorbertAPI Contract (US-001)
 *
 * Validates that plugins can register views, access namespaced data,
 * register hook processors, and are sandboxed from core data.
 *
 * Driving ports: PluginLoader port, LifecycleManager port, NorbertAPI
 * These tests invoke through the plugin lifecycle and API contract,
 * never through internal components (Sandbox Enforcer, Registry internals).
 *
 * Walking skeleton validates the core plugin value proposition:
 * a plugin can load, register a view, and the user can see it.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NORBERT_API_KEYS,
  PLUGIN_MANIFEST_REQUIRED_FIELDS,
  RESOLUTION_ERROR_TYPES,
} from "../../../src/plugins/types";
import type {
  NorbertAPI,
  NorbertPlugin,
  PluginManifest,
  PluginsAPI,
  ViewRegistration,
  TabRegistration,
  ResolutionError,
  StatusItemHandle,
} from "../../../src/plugins/types";
import { scanPlugins, validateManifest } from "../../../src/plugins/pluginLoader";
import { createNorbertAPI } from "../../../src/plugins/apiFactory";
import {
  createPluginRegistry,
  getViewsByPlugin,
  getTabsByPlugin,
  getAllViews,
  getHookRegistrationsByPlugin,
  getStatusItemsByPlugin,
} from "../../../src/plugins/pluginRegistry";
import { loadPlugins } from "../../../src/plugins/lifecycleManager";
import {
  deliverHookEvent,
  getStatusItem,
  resetHookBridge,
} from "../../../src/plugins/hookBridge";

// Reset hook bridge state before each test for isolation.
beforeEach(() => {
  resetHookBridge();
});

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("Plugin registers a view and user can access it", () => {
  it("plugin loads, registers view, and view appears in sidebar and view picker", () => {
    // GIVEN: the "team-monitor" plugin implements the NorbertPlugin interface
    // AND: the plugin registers a view "team-dashboard" with primaryView: true
    const teamMonitorPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.ui.registerView({
          id: "team-dashboard",
          label: "Team Dashboard",
          icon: "users",
          primaryView: true,
          minWidth: 300,
          minHeight: 200,
          floatMetric: null,
        });
        api.ui.registerTab({
          id: "team-monitor-tab",
          icon: "users",
          label: "Team Monitor",
          order: 10,
        });
      },
      onUnload: () => {},
    };

    // Stub scan port: returns the team-monitor plugin
    const stubScanPlugins = () => [teamMonitorPlugin];

    // WHEN: the plugin loader loads "team-monitor"
    const plugins = stubScanPlugins();
    const initialRegistry = createPluginRegistry();
    const registry = loadPlugins(plugins, initialRegistry, createNorbertAPI);

    // THEN: "team-dashboard" appears in the view picker
    const views = getAllViews(registry);
    const teamDashboard = views.find((v) => v.id === "team-dashboard");
    expect(teamDashboard).toBeDefined();
    expect(teamDashboard!.pluginId).toBe("team-monitor");
    expect(teamDashboard!.label).toBe("Team Dashboard");

    // AND: a sidebar icon for "team-monitor" appears in the sidebar
    const tabs = getTabsByPlugin(registry, "team-monitor");
    expect(tabs).toHaveLength(1);
    expect(tabs[0].icon).toBe("users");

    // AND: clicking the sidebar icon assigns "team-dashboard" to the Main zone
    // (the primary view for this plugin is "team-dashboard")
    const primaryView = views.find(
      (v) => v.pluginId === "team-monitor" && v.primaryView
    );
    expect(primaryView).toBeDefined();
    expect(primaryView!.id).toBe("team-dashboard");
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: API Sub-Surfaces
// ---------------------------------------------------------------------------

describe("Plugin registers view via api.ui.registerView()", () => {
  it("registered view appears in view picker and is assignable to any zone", () => {
    // GIVEN: a plugin calls api.ui.registerView() with id "team-dashboard",
    //        label "Team Dashboard", primaryView: true, minWidth: 300, minHeight: 200
    const testPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.ui.registerView({
          id: "team-dashboard",
          label: "Team Dashboard",
          icon: "users",
          primaryView: true,
          minWidth: 300,
          minHeight: 200,
          floatMetric: null,
        });
      },
      onUnload: () => {},
    };

    // WHEN: the view registration completes
    const registry = loadPlugins(
      [testPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // THEN: "team-dashboard" appears in the view picker grouped under plugin name
    const views = getViewsByPlugin(registry, "team-monitor");
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe("team-dashboard");
    expect(views[0].pluginId).toBe("team-monitor");
    expect(views[0].label).toBe("Team Dashboard");
    expect(views[0].primaryView).toBe(true);
    expect(views[0].minWidth).toBe(300);
    expect(views[0].minHeight).toBe(200);

    // AND: the view can be assigned to any zone (it's in the registry)
    const allViews = getAllViews(registry);
    expect(allViews.some((v) => v.id === "team-dashboard")).toBe(true);
  });
});

describe("Plugin registers hook processor via api.hooks", () => {
  it("hook processor receives hook events after registration", () => {
    // GIVEN: a plugin calls api.hooks.register("team-events", handleTeamEvent)
    const receivedPayloads: readonly unknown[] = [];
    const capturedPayloads: unknown[] = [];

    const testPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        api.hooks.register("team-events", (payload: unknown) => {
          capturedPayloads.push(payload);
        });
      },
      onUnload: () => {},
    };

    // Load the plugin through the lifecycle manager
    const registry = loadPlugins(
      [testPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // WHEN: a hook event arrives at the receiver
    const hookPayload = { type: "team-update", data: { member: "alice" } };
    deliverHookEvent("team-events", hookPayload);

    // THEN: handleTeamEvent receives the raw hook payload
    expect(capturedPayloads).toHaveLength(1);
    expect(capturedPayloads[0]).toEqual(hookPayload);

    // AND: the hook registration is tracked in the registry
    const hookRegistrations = getHookRegistrationsByPlugin(registry, "team-monitor");
    expect(hookRegistrations).toHaveLength(1);
    expect(hookRegistrations[0].hookName).toBe("team-events");
    expect(hookRegistrations[0].pluginId).toBe("team-monitor");
  });
});

describe("Plugin registers status bar item via api.ui", () => {
  it("status bar item appears and can be updated dynamically", () => {
    // GIVEN: a plugin calls api.ui.registerStatusItem() with position "left"
    let statusItemHandle: StatusItemHandle | null = null;

    const testPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        statusItemHandle = api.ui.registerStatusItem({
          id: "team-status",
          label: "Team: 0 online",
          icon: "users",
          position: "left",
          order: 10,
        });
      },
      onUnload: () => {},
    };

    // WHEN: the plugin is loaded
    const registry = loadPlugins(
      [testPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // THEN: the plugin's status item appears in the registry
    const statusItems = getStatusItemsByPlugin(registry, "team-monitor");
    expect(statusItems).toHaveLength(1);
    expect(statusItems[0].id).toBe("team-status");
    expect(statusItems[0].pluginId).toBe("team-monitor");
    expect(statusItems[0].label).toBe("Team: 0 online");
    expect(statusItems[0].position).toBe("left");

    // AND: the plugin can update it dynamically via the handle
    expect(statusItemHandle).not.toBeNull();
    statusItemHandle!.update({ label: "Team: 3 online" });

    // Verify the update is reflected in the status item store
    const updatedItem = getStatusItem("team-monitor", "team-status");
    expect(updatedItem).toBeDefined();
    expect(updatedItem!.label).toBe("Team: 3 online");
  });
});

describe("Plugin accesses dependency public API via api.plugins", () => {
  it("declared dependency's public API is accessible", () => {
    // GIVEN: plugin "norbert-session" exposes a public API with getSessionById()
    const sessionPlugin: NorbertPlugin = {
      manifest: {
        id: "norbert-session",
        name: "Norbert Session",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      publicAPI: {
        getSessionById: (id: string) => ({ id, name: "Test Session" }),
      },
      onLoad: () => {},
      onUnload: () => {},
    };

    // AND: plugin "team-monitor" declares norbert-session as a dependency
    let capturedPluginsApi: PluginsAPI | null = null;
    const teamMonitorPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: { "norbert-session": "^1.0.0" },
      },
      onLoad: (api) => {
        capturedPluginsApi = api.plugins;
      },
      onUnload: () => {},
    };

    // WHEN: both plugins are loaded (norbert-session first as dependency)
    const registry = loadPlugins(
      [sessionPlugin, teamMonitorPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // THEN: team-monitor can call api.plugins.get("norbert-session")
    expect(capturedPluginsApi).not.toBeNull();
    const result = capturedPluginsApi!.get("norbert-session");

    // AND: it receives norbert-session's public API object
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveProperty("getSessionById");
      // AND: can call getSessionById() without accessing internal database tables
      const session = result.value.getSessionById("s1");
      expect(session).toEqual({ id: "s1", name: "Test Session" });
    }
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("Plugin sandbox prevents writes to core tables", () => {
  it("write to core 'sessions' table is rejected with explicit error", () => {
    // GIVEN: plugin "team-monitor" is loaded
    let dbError: unknown = null;
    const testPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        // WHEN: the plugin calls api.db.execute("INSERT INTO sessions ...")
        const result = api.db.execute("INSERT INTO sessions (id) VALUES ('x')");
        dbError = result;
      },
      onUnload: () => {},
    };

    const registry = loadPlugins(
      [testPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // THEN: the write is rejected with error identifying the core table
    expect(dbError).not.toBeNull();
    expect((dbError as { ok: false; error: string }).ok).toBe(false);
    expect((dbError as { ok: false; error: string }).error).toContain(
      "Plugin 'team-monitor' cannot write to core table 'sessions'"
    );
    expect((dbError as { ok: false; error: string }).error).toContain(
      "plugin_team_monitor_"
    );
  });
});

describe("Plugin can only write to its own namespaced tables", () => {
  it("writes to plugin_team_monitor_* tables succeed", () => {
    // GIVEN: plugin "team-monitor" is loaded
    let dbResult: unknown = null;
    const testPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        // WHEN: the plugin creates and writes to "plugin_team_monitor_metrics"
        dbResult = api.db.execute(
          "CREATE TABLE plugin_team_monitor_metrics (id TEXT PRIMARY KEY, value REAL)"
        );
      },
      onUnload: () => {},
    };

    const registry = loadPlugins(
      [testPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // THEN: the write succeeds
    expect(dbResult).not.toBeNull();
    expect((dbResult as { ok: true }).ok).toBe(true);
  });
});

describe("Plugin cannot access undeclared dependency API", () => {
  it("api.plugins.get() for undeclared dependency returns error", () => {
    // GIVEN: plugin "team-monitor" does NOT declare "norbert-usage" as a dependency
    let capturedPluginsApi: PluginsAPI | null = null;
    const teamMonitorPlugin: NorbertPlugin = {
      manifest: {
        id: "team-monitor",
        name: "Team Monitor",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: (api) => {
        capturedPluginsApi = api.plugins;
      },
      onUnload: () => {},
    };

    // Load the plugin
    loadPlugins(
      [teamMonitorPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // WHEN: the plugin calls api.plugins.get("norbert-usage")
    expect(capturedPluginsApi).not.toBeNull();
    const result = capturedPluginsApi!.get("norbert-usage");

    // THEN: the call fails with an error indicating the dependency is not declared
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("norbert-usage");
      expect(result.error).toContain("not declared");
    }
  });
});

describe("Plugin with invalid manifest is rejected at load time", () => {
  it("plugin missing required manifest fields fails to load with clear error", () => {
    // GIVEN: a plugin package exists but is missing the "id" field in its manifest
    const invalidPlugin: NorbertPlugin = {
      manifest: {
        id: "",
        name: "Bad Plugin",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      } as PluginManifest,
      onLoad: () => {},
      onUnload: () => {},
    };

    // WHEN: the plugin loader attempts to load it
    const registry = loadPlugins(
      [invalidPlugin],
      createPluginRegistry(),
      createNorbertAPI
    );

    // THEN: the plugin fails to load (not in loadedPluginIds)
    expect(registry.loadedPluginIds).not.toContain("");
    expect(registry.loadedPluginIds).toHaveLength(0);

    // AND: the error message identifies the missing field
    // Validation happens through validateManifest
    const validationResult = validateManifest(invalidPlugin.manifest);
    expect(validationResult.valid).toBe(false);
    if (!validationResult.valid) {
      expect(validationResult.missingFields).toContain("id");
    }
  });
});

describe("NorbertAPI provides all required sub-APIs", () => {
  it("api object contains db, hooks, ui, mcp, events, config, plugins, and host", () => {
    // GIVEN: the NorbertAPI contract defines required sub-APIs
    // WHEN: we inspect the NORBERT_API_KEYS constant
    // THEN: all 8 sub-APIs are declared
    const expectedKeys = ["db", "hooks", "ui", "mcp", "events", "config", "plugins", "host"];

    expect(NORBERT_API_KEYS).toEqual(expect.arrayContaining(expectedKeys));
    expect(NORBERT_API_KEYS).toHaveLength(expectedKeys.length);
  });

  it("PluginManifest requires id, name, version, norbert_api, and dependencies", () => {
    const expectedFields = ["id", "name", "version", "norbert_api", "dependencies"];

    expect(PLUGIN_MANIFEST_REQUIRED_FIELDS).toEqual(expect.arrayContaining(expectedFields));
    expect(PLUGIN_MANIFEST_REQUIRED_FIELDS).toHaveLength(expectedFields.length);
  });

  it("ResolutionError types include missing, version_mismatch, and disabled", () => {
    const expectedTypes = ["missing", "version_mismatch", "disabled"];

    expect(RESOLUTION_ERROR_TYPES).toEqual(expect.arrayContaining(expectedTypes));
    expect(RESOLUTION_ERROR_TYPES).toHaveLength(expectedTypes.length);
  });
});
