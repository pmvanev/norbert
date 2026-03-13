/**
 * Unit tests: Plugin Loader
 *
 * Validates the scan pipeline: scan -> validate -> resolve.
 * Pure functions tested with stub filesystem ports.
 */

import { describe, it, expect } from "vitest";
import {
  validateManifest,
  scanPlugins,
} from "../../../src/plugins/pluginLoader";
import type { PluginManifest, NorbertPlugin } from "../../../src/plugins/types";

describe("validateManifest", () => {
  it("returns valid for a complete manifest", () => {
    const manifest: PluginManifest = {
      id: "team-monitor",
      name: "Team Monitor",
      version: "1.0.0",
      norbert_api: "^1.0.0",
      dependencies: {},
    };

    const result = validateManifest(manifest);

    expect(result.valid).toBe(true);
  });

  it("returns invalid with missing fields for incomplete manifest", () => {
    const incomplete = {
      id: "test",
      name: "Test",
    } as unknown as PluginManifest;

    const result = validateManifest(incomplete);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missingFields.length).toBeGreaterThan(0);
    }
  });

  it("detects missing version field", () => {
    const noVersion = {
      id: "test",
      name: "Test",
      norbert_api: "^1.0.0",
      dependencies: {},
    } as unknown as PluginManifest;

    const result = validateManifest(noVersion);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.missingFields).toContain("version");
    }
  });
});

describe("scanPlugins", () => {
  it("returns the provided plugin packages as-is for in-memory sources", () => {
    const plugin: NorbertPlugin = {
      manifest: {
        id: "test-plugin",
        name: "Test",
        version: "1.0.0",
        norbert_api: "^1.0.0",
        dependencies: {},
      },
      onLoad: () => {},
      onUnload: () => {},
    };

    const result = scanPlugins([plugin]);

    expect(result).toHaveLength(1);
    expect(result[0].manifest.id).toBe("test-plugin");
  });

  it("returns empty array when no plugins provided", () => {
    const result = scanPlugins([]);

    expect(result).toHaveLength(0);
  });
});
