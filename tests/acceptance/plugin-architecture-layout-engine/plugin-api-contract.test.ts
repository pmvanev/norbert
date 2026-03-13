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

import { describe, it, expect } from "vitest";
import {
  NORBERT_API_KEYS,
  PLUGIN_MANIFEST_REQUIRED_FIELDS,
  RESOLUTION_ERROR_TYPES,
} from "../../../src/plugins/types";
import type {
  NorbertAPI,
  PluginManifest,
  ViewRegistration,
  TabRegistration,
  ResolutionError,
} from "../../../src/plugins/types";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

// @walking_skeleton
describe("Plugin registers a view and user can access it", () => {
  it.skip("plugin loads, registers view, and view appears in sidebar and view picker", () => {
    // GIVEN: the "team-monitor" plugin implements the NorbertPlugin interface
    // AND: the plugin registers a view "team-dashboard" with primaryView: true
    // WHEN: the plugin loader loads "team-monitor"
    // THEN: "team-dashboard" appears in the view picker
    // AND: a sidebar icon for "team-monitor" appears in the sidebar
    // AND: clicking the sidebar icon assigns "team-dashboard" to the Main zone
    //
    // Driving port: PluginLoader port -> LifecycleManager port -> NorbertAPI.ui
    // Observable outcome: view visible in picker, sidebar icon present,
    // view assignable to zone.
  });
});

// ---------------------------------------------------------------------------
// FOCUSED SCENARIOS: API Sub-Surfaces
// ---------------------------------------------------------------------------

describe("Plugin registers view via api.ui.registerView()", () => {
  it.skip("registered view appears in view picker and is assignable to any zone", () => {
    // GIVEN: a plugin calls api.ui.registerView() with id "team-dashboard",
    //        label "Team Dashboard", primaryView: true, minWidth: 300, minHeight: 200
    // WHEN: the view registration completes
    // THEN: "team-dashboard" appears in the view picker grouped under plugin name
    // AND: the view can be assigned to any zone
    //
    // Driving port: NorbertAPI.ui.registerView()
  });
});

describe("Plugin registers hook processor via api.hooks", () => {
  it.skip("hook processor receives hook events after registration", () => {
    // GIVEN: a plugin calls api.hooks.register("team-events", handleTeamEvent)
    // WHEN: a hook event arrives at the receiver
    // THEN: handleTeamEvent receives the raw hook payload
    // AND: the plugin can write derived data to its namespaced tables via api.db
    //
    // Driving port: NorbertAPI.hooks.register()
  });
});

describe("Plugin registers status bar item via api.ui", () => {
  it.skip("status bar item appears and can be updated dynamically", () => {
    // GIVEN: a plugin calls api.ui.registerStatusItem() with position "left"
    // WHEN: the status bar renders
    // THEN: the plugin's status item appears after core Norbert items
    // AND: the plugin can update it dynamically via api.ui.setStatusItem()
    //
    // Driving port: NorbertAPI.ui.registerStatusItem()
  });
});

describe("Plugin accesses dependency public API via api.plugins", () => {
  it.skip("declared dependency's public API is accessible", () => {
    // GIVEN: plugin "team-monitor" declares norbert-session as a dependency
    // AND: norbert-session exposes a public API with getSessionById()
    // WHEN: team-monitor calls api.plugins.get("norbert-session")
    // THEN: it receives norbert-session's public API object
    // AND: can call getSessionById() without accessing internal database tables
    //
    // Driving port: NorbertAPI.plugins.get()
  });
});

// ---------------------------------------------------------------------------
// ERROR SCENARIOS
// ---------------------------------------------------------------------------

describe("Plugin sandbox prevents writes to core tables", () => {
  it.skip("write to core 'sessions' table is rejected with explicit error", () => {
    // GIVEN: plugin "team-monitor" is loaded
    // WHEN: the plugin calls api.db.execute("INSERT INTO sessions ...")
    // THEN: the write is rejected with error:
    //       "Plugin 'team-monitor' cannot write to core table 'sessions'.
    //        Use your namespaced tables: 'plugin_team_monitor_*'."
    // AND: Norbert's core data remains unmodified
    //
    // Driving port: NorbertAPI.db (sandbox enforcement)
  });
});

describe("Plugin can only write to its own namespaced tables", () => {
  it.skip("writes to plugin_team_monitor_* tables succeed", () => {
    // GIVEN: plugin "team-monitor" is loaded
    // WHEN: the plugin creates and writes to "plugin_team_monitor_metrics"
    // THEN: the write succeeds
    // AND: data is persisted in the plugin's namespace
    //
    // Driving port: NorbertAPI.db
  });
});

describe("Plugin cannot access undeclared dependency API", () => {
  it.skip("api.plugins.get() for undeclared dependency returns error", () => {
    // GIVEN: plugin "team-monitor" does NOT declare "norbert-usage" as a dependency
    // WHEN: the plugin calls api.plugins.get("norbert-usage")
    // THEN: the call fails with an error indicating the dependency is not declared
    //
    // Driving port: NorbertAPI.plugins.get()
  });
});

describe("Plugin with invalid manifest is rejected at load time", () => {
  it.skip("plugin missing required manifest fields fails to load with clear error", () => {
    // GIVEN: a plugin package exists but is missing the "id" field in its manifest
    // WHEN: the plugin loader attempts to load it
    // THEN: the plugin fails to load
    // AND: the error message identifies the missing field
    //
    // Driving port: PluginLoader port
  });
});

describe("NorbertAPI provides all required sub-APIs", () => {
  it("api object contains db, hooks, ui, mcp, events, config, and plugins", () => {
    // GIVEN: the NorbertAPI contract defines required sub-APIs
    // WHEN: we inspect the NORBERT_API_KEYS constant
    // THEN: all 7 sub-APIs are declared
    const expectedKeys = ["db", "hooks", "ui", "mcp", "events", "config", "plugins"];

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
