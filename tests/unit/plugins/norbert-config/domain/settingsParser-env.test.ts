/**
 * Unit tests: settingsParser env extraction
 *
 * Tests extractTopLevelEnvVars behavior through parseSettings driving port.
 * Properties: non-string filtering, alphabetical sorting, scope attribution.
 * Examples: edge cases, empty/missing blocks.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseSettings } from "../../../../../src/plugins/norbert-config/domain/settingsParser";
import type { EnvVarEntry } from "../../../../../src/plugins/norbert-config/domain/types";

// ---------------------------------------------------------------------------
// Property: non-string values are always filtered out
// ---------------------------------------------------------------------------

describe("extractTopLevelEnvVars via parseSettings", () => {
  it("filters out all non-string values", () => {
    const mixedEnv = fc.record({
      stringVal: fc.constant("hello"),
      numberVal: fc.constant(42),
      objectVal: fc.constant({ nested: true }),
      arrayVal: fc.constant([1, 2]),
      nullVal: fc.constant(null),
      boolVal: fc.constant(true),
    });

    fc.assert(
      fc.property(mixedEnv, (envBlock) => {
        const json = JSON.stringify({ env: envBlock });
        const result = parseSettings(json, "user");
        if (result.tag !== "parsed") return;

        // Only stringVal should survive
        expect(result.envVars).toHaveLength(1);
        expect(result.envVars[0].key).toBe("stringVal");
        expect(result.envVars[0].value).toBe("hello");
      }),
      { numRuns: 10 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property: results are always sorted by key
  // ---------------------------------------------------------------------------

  it("results are always sorted alphabetically by key", () => {
    const envArb = fc.dictionary(
      fc.stringMatching(/^[A-Z][A-Z0-9_]{0,15}$/),
      fc.string({ maxLength: 30 }),
      { minKeys: 2, maxKeys: 10 },
    );

    fc.assert(
      fc.property(envArb, (envBlock) => {
        const json = JSON.stringify({ env: envBlock });
        const result = parseSettings(json, "user");
        if (result.tag !== "parsed") return;

        const keys = result.envVars.map((e) => e.key);
        const sorted = [...keys].sort();
        expect(keys).toEqual(sorted);
      }),
      { numRuns: 100 },
    );
  });

  // ---------------------------------------------------------------------------
  // Property: scope is always propagated from caller
  // ---------------------------------------------------------------------------

  it("scope matches the scope parameter passed to parseSettings", () => {
    const scopeArb = fc.constantFrom("user" as const, "project" as const);

    fc.assert(
      fc.property(scopeArb, (scope) => {
        const json = JSON.stringify({ env: { KEY: "val" } });
        const result = parseSettings(json, scope);
        if (result.tag !== "parsed") return;

        expect(result.envVars.every((e) => e.scope === scope)).toBe(true);
      }),
    );
  });

  // ---------------------------------------------------------------------------
  // Example: source field is "settings.json"
  // ---------------------------------------------------------------------------

  it("sets source to settings.json for each entry", () => {
    const json = JSON.stringify({ env: { MY_VAR: "val" } });
    const result = parseSettings(json, "user");

    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars[0].source).toBe("settings.json");
  });

  // ---------------------------------------------------------------------------
  // Example: filePath defaults to empty string
  // ---------------------------------------------------------------------------

  it("sets filePath to empty string (populated by caller)", () => {
    const json = JSON.stringify({ env: { MY_VAR: "val" } });
    const result = parseSettings(json, "user");

    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars[0].filePath).toBe("");
  });

  // ---------------------------------------------------------------------------
  // Example: env block is not an object (array, string, number)
  // ---------------------------------------------------------------------------

  it("returns empty array when env block is an array", () => {
    const json = JSON.stringify({ env: ["not", "an", "object"] });
    const result = parseSettings(json, "user");

    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toEqual([]);
  });

  it("returns empty array when env block is a string", () => {
    const json = JSON.stringify({ env: "not an object" });
    const result = parseSettings(json, "user");

    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;

    expect(result.envVars).toEqual([]);
  });
});
