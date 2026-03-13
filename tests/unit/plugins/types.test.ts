/**
 * Unit tests: Plugin type definitions
 *
 * Validates that all algebraic data types for the plugin architecture
 * are correctly defined with proper const arrays, type unions, and
 * structural properties.
 */

import { describe, it, expect } from "vitest";
import {
  NORBERT_API_KEYS,
  PLUGIN_MANIFEST_REQUIRED_FIELDS,
  RESOLUTION_ERROR_TYPES,
  isValidResolutionErrorType,
  isValidNorbertApiKey,
} from "../../../src/plugins/types";
import type {
  NorbertAPI,
  DbAPI,
  HooksAPI,
  UiAPI,
  McpAPI,
  EventsAPI,
  ConfigAPI,
  PluginsAPI,
  PluginManifest,
  ViewRegistration,
  TabRegistration,
  ResolutionError,
  ResolutionErrorType,
  NorbertApiKey,
} from "../../../src/plugins/types";

// ---------------------------------------------------------------------------
// NorbertAPI sub-API keys
// ---------------------------------------------------------------------------

describe("NORBERT_API_KEYS", () => {
  it("contains exactly the 7 required sub-API keys", () => {
    expect(NORBERT_API_KEYS).toEqual([
      "db",
      "hooks",
      "ui",
      "mcp",
      "events",
      "config",
      "plugins",
    ]);
  });

  it("has exactly 7 entries", () => {
    // The array is readonly at the type level via `as const`.
    // At runtime we verify the count matches expectations.
    expect(NORBERT_API_KEYS).toHaveLength(7);
  });
});

describe("isValidNorbertApiKey", () => {
  it("returns true for each valid sub-API key", () => {
    for (const key of NORBERT_API_KEYS) {
      expect(isValidNorbertApiKey(key)).toBe(true);
    }
  });

  it("returns false for unknown keys", () => {
    expect(isValidNorbertApiKey("unknown")).toBe(false);
    expect(isValidNorbertApiKey("")).toBe(false);
    expect(isValidNorbertApiKey(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PluginManifest required fields
// ---------------------------------------------------------------------------

describe("PLUGIN_MANIFEST_REQUIRED_FIELDS", () => {
  it("contains id, name, version, norbert_api, and dependencies", () => {
    expect(PLUGIN_MANIFEST_REQUIRED_FIELDS).toEqual([
      "id",
      "name",
      "version",
      "norbert_api",
      "dependencies",
    ]);
  });
});

// ---------------------------------------------------------------------------
// ResolutionError types
// ---------------------------------------------------------------------------

describe("RESOLUTION_ERROR_TYPES", () => {
  it("contains missing, version_mismatch, and disabled", () => {
    expect(RESOLUTION_ERROR_TYPES).toEqual([
      "missing",
      "version_mismatch",
      "disabled",
    ]);
  });
});

describe("isValidResolutionErrorType", () => {
  it("returns true for each valid resolution error type", () => {
    for (const errorType of RESOLUTION_ERROR_TYPES) {
      expect(isValidResolutionErrorType(errorType)).toBe(true);
    }
  });

  it("returns false for unknown error types", () => {
    expect(isValidResolutionErrorType("unknown")).toBe(false);
    expect(isValidResolutionErrorType("")).toBe(false);
    expect(isValidResolutionErrorType(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type structural validation (compile-time + runtime shape)
// ---------------------------------------------------------------------------

describe("PluginManifest type structure", () => {
  it("captures all required fields with correct types", () => {
    const manifest: PluginManifest = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      norbert_api: "^1.0.0",
      dependencies: { "other-plugin": "^2.0.0" },
    };

    expect(manifest.id).toBe("test-plugin");
    expect(manifest.name).toBe("Test Plugin");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.norbert_api).toBe("^1.0.0");
    expect(manifest.dependencies).toEqual({ "other-plugin": "^2.0.0" });
  });

  it("supports empty dependencies", () => {
    const manifest: PluginManifest = {
      id: "standalone-plugin",
      name: "Standalone",
      version: "0.1.0",
      norbert_api: "^1.0.0",
      dependencies: {},
    };

    expect(manifest.dependencies).toEqual({});
  });
});

describe("ViewRegistration type structure", () => {
  it("captures all required fields including layout constraints", () => {
    const view: ViewRegistration = {
      id: "session-list",
      pluginId: "norbert-session",
      label: "Session List",
      icon: "list-icon",
      primaryView: true,
      minWidth: 280,
      minHeight: 200,
      floatMetric: "active_session_count",
    };

    expect(view.id).toBe("session-list");
    expect(view.pluginId).toBe("norbert-session");
    expect(view.primaryView).toBe(true);
    expect(view.minWidth).toBe(280);
    expect(view.minHeight).toBe(200);
    expect(view.floatMetric).toBe("active_session_count");
  });

  it("allows null floatMetric for views without floating metric", () => {
    const view: ViewRegistration = {
      id: "settings-view",
      pluginId: "norbert-core",
      label: "Settings",
      icon: "gear-icon",
      primaryView: false,
      minWidth: 300,
      minHeight: 200,
      floatMetric: null,
    };

    expect(view.floatMetric).toBeNull();
  });
});

describe("TabRegistration type structure", () => {
  it("captures all required fields", () => {
    const tab: TabRegistration = {
      id: "sessions",
      pluginId: "norbert-session",
      icon: "session-icon",
      label: "Sessions",
      order: 1,
    };

    expect(tab.id).toBe("sessions");
    expect(tab.pluginId).toBe("norbert-session");
    expect(tab.order).toBe(1);
  });
});

describe("ResolutionError type structure", () => {
  it("captures missing dependency error", () => {
    const error: ResolutionError = {
      pluginId: "team-monitor",
      type: "missing",
      dependency: "norbert-session",
      requiredVersion: "^1.0.0",
      installedVersion: null,
    };

    expect(error.type).toBe("missing");
    expect(error.installedVersion).toBeNull();
  });

  it("captures version mismatch error", () => {
    const error: ResolutionError = {
      pluginId: "team-monitor",
      type: "version_mismatch",
      dependency: "norbert-session",
      requiredVersion: "^2.0.0",
      installedVersion: "1.5.0",
    };

    expect(error.type).toBe("version_mismatch");
    expect(error.installedVersion).toBe("1.5.0");
  });

  it("captures disabled dependency error", () => {
    const error: ResolutionError = {
      pluginId: "team-monitor",
      type: "disabled",
      dependency: "norbert-session",
      requiredVersion: "^1.0.0",
      installedVersion: "1.2.0",
    };

    expect(error.type).toBe("disabled");
  });
});
