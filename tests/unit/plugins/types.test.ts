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

