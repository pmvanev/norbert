/**
 * Acceptance tests: Env Var Extraction (config-env-viewer, step 01-01)
 *
 * Validates that settings.json top-level env block is parsed into
 * EnvVarEntry[] with scope/source/filePath attribution, sorted
 * alphabetically by key. Non-string values are filtered out.
 *
 * Driving port: pure domain function (parseSettings)
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseSettings } from "../../../src/plugins/norbert-config/domain/settingsParser";

// ---------------------------------------------------------------------------
// WALKING SKELETON
// ---------------------------------------------------------------------------

describe("User views environment variables from settings", () => {
  it("parses settings with 5 OTEL env vars into 5 sorted entries", () => {
    // Given settings.json with 5 OTEL env vars in top-level env block
    const settingsJson = JSON.stringify({
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
        OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
        OTEL_LOG_LEVEL: "debug",
        OTEL_SERVICE_NAME: "norbert",
        OTEL_TRACES_SAMPLER: "always_on",
      },
    });

    // When settings are parsed at user scope
    const result = parseSettings(settingsJson, "user");

    // Then parsing succeeds
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    // And 5 env var entries are extracted
    expect(result.envVars).toHaveLength(5);

    // And entries are sorted alphabetically by key
    const keys = result.envVars.map((e) => e.key);
    expect(keys).toEqual([
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_PROTOCOL",
      "OTEL_LOG_LEVEL",
      "OTEL_SERVICE_NAME",
      "OTEL_TRACES_SAMPLER",
    ]);

    // And each entry has correct scope
    expect(result.envVars.every((e) => e.scope === "user")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // SCOPE ATTRIBUTION
  // ---------------------------------------------------------------------------

  it("attributes user scope for user-level settings", () => {
    const settingsJson = JSON.stringify({
      env: { MY_VAR: "val" },
    });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars[0].scope).toBe("user");
  });

  it("attributes project scope for project-level settings", () => {
    const settingsJson = JSON.stringify({
      env: { MY_VAR: "val" },
    });

    const result = parseSettings(settingsJson, "project");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars[0].scope).toBe("project");
  });

  // ---------------------------------------------------------------------------
  // MISSING / EMPTY ENV BLOCK
  // ---------------------------------------------------------------------------

  it("produces empty array when env block is missing", () => {
    const settingsJson = JSON.stringify({ hooks: {} });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toEqual([]);
  });

  it("produces empty array when env block is empty object", () => {
    const settingsJson = JSON.stringify({ env: {} });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // NON-STRING FILTERING
  // ---------------------------------------------------------------------------

  it("filters out non-string values (objects, numbers, arrays)", () => {
    const settingsJson = JSON.stringify({
      env: {
        GOOD_VAR: "hello",
        BAD_OBJECT: { nested: true },
        BAD_NUMBER: 42,
        BAD_ARRAY: [1, 2, 3],
        ALSO_GOOD: "world",
      },
    });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    // Only string values kept, sorted alphabetically
    expect(result.envVars).toHaveLength(2);
    expect(result.envVars.map((e) => e.key)).toEqual(["ALSO_GOOD", "GOOD_VAR"]);
  });

  // ---------------------------------------------------------------------------
  // EDGE CASES
  // ---------------------------------------------------------------------------

  it("handles single env var", () => {
    const settingsJson = JSON.stringify({
      env: { SINGLE: "value" },
    });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toHaveLength(1);
    expect(result.envVars[0].key).toBe("SINGLE");
    expect(result.envVars[0].value).toBe("value");
  });

  it("preserves special characters in values", () => {
    const settingsJson = JSON.stringify({
      env: { URL: "http://localhost:4318/v1/traces?key=abc&flag=true" },
    });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars[0].value).toBe(
      "http://localhost:4318/v1/traces?key=abc&flag=true",
    );
  });

  it("includes empty string values", () => {
    const settingsJson = JSON.stringify({
      env: { EMPTY: "" },
    });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toHaveLength(1);
    expect(result.envVars[0].value).toBe("");
  });

  // ---------------------------------------------------------------------------
  // MIXED VARS (6 including CUSTOM_LOG_LEVEL)
  // ---------------------------------------------------------------------------

  it("parses mixed env vars sorted correctly", () => {
    const settingsJson = JSON.stringify({
      env: {
        OTEL_EXPORTER_OTLP_ENDPOINT: "http://localhost:4318",
        OTEL_SERVICE_NAME: "norbert",
        CUSTOM_LOG_LEVEL: "info",
        OTEL_LOG_LEVEL: "debug",
        OTEL_EXPORTER_OTLP_PROTOCOL: "http/protobuf",
        OTEL_TRACES_SAMPLER: "always_on",
      },
    });

    const result = parseSettings(settingsJson, "user");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toHaveLength(6);
    expect(result.envVars.map((e) => e.key)).toEqual([
      "CUSTOM_LOG_LEVEL",
      "OTEL_EXPORTER_OTLP_ENDPOINT",
      "OTEL_EXPORTER_OTLP_PROTOCOL",
      "OTEL_LOG_LEVEL",
      "OTEL_SERVICE_NAME",
      "OTEL_TRACES_SAMPLER",
    ]);
  });

  // ---------------------------------------------------------------------------
  // PROPERTY: always sorted, count matches
  // ---------------------------------------------------------------------------

  it("env vars are always sorted alphabetically and count matches entries", () => {
    const envArbitrary = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes('"')),
      fc.string({ maxLength: 50 }),
      { minKeys: 0, maxKeys: 20 },
    );

    fc.assert(
      fc.property(envArbitrary, (envBlock) => {
        const settingsJson = JSON.stringify({ env: envBlock });
        const result = parseSettings(settingsJson, "user");
        expect(result.tag).toBe("parsed");
        if (result.tag !== "parsed") return;

        // Count matches number of string entries
        const expectedCount = Object.values(envBlock).filter(
          (v) => typeof v === "string",
        ).length;
        expect(result.envVars).toHaveLength(expectedCount);

        // Always sorted alphabetically by key
        const keys = result.envVars.map((e) => e.key);
        const sortedKeys = [...keys].sort();
        expect(keys).toEqual(sortedKeys);
      }),
      { numRuns: 100 },
    );
  });
});
