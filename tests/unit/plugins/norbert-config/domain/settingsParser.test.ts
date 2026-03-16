/**
 * Unit tests: settingsParser -- property-based and example-based
 *
 * Properties:
 *   - Malformed JSON always returns error tag
 *   - Valid JSON never throws
 *   - Missing sections produce empty arrays
 *   - Hook count equals sum of entries across all event types
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseSettings } from "../../../../../src/plugins/norbert-config/domain/settingsParser";

// ---------------------------------------------------------------------------
// Property: malformed JSON always yields error tag
// ---------------------------------------------------------------------------

describe("settingsParser properties", () => {
  it("malformed JSON always returns error tag", () => {
    const malformedJson = fc.oneof(
      fc.string().filter((s) => {
        try {
          JSON.parse(s);
          return false;
        } catch {
          return true;
        }
      }),
      fc.constant("{ broken"),
      fc.constant("{,}"),
      fc.constant("not json at all"),
    );

    fc.assert(
      fc.property(malformedJson, (input) => {
        const result = parseSettings(input);
        expect(result.tag).toBe("error");
      }),
      { numRuns: 50 },
    );
  });

  it("valid JSON object never throws and returns parsed or error", () => {
    fc.assert(
      fc.property(fc.json(), (jsonStr) => {
        const result = parseSettings(jsonStr);
        expect(["parsed", "error"]).toContain(result.tag);
      }),
      { numRuns: 100 },
    );
  });

  it("empty object returns parsed with all empty arrays", () => {
    const result = parseSettings("{}");
    expect(result.tag).toBe("parsed");
    if (result.tag !== "parsed") return;
    expect(result.hooks).toEqual([]);
    expect(result.mcpServers).toEqual([]);
    expect(result.rules).toEqual([]);
    expect(result.plugins).toEqual([]);
  });

  it("hook count equals total entries across all event types", () => {
    const hookEntryArb = fc.record({
      command: fc.string({ minLength: 1 }),
      matchers: fc.option(fc.array(fc.string()), { nil: undefined }),
    });

    const hooksArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.array(hookEntryArb, { minLength: 1, maxLength: 3 }),
    );

    fc.assert(
      fc.property(hooksArb, (hooks) => {
        const json = JSON.stringify({ hooks });
        const result = parseSettings(json);
        expect(result.tag).toBe("parsed");
        if (result.tag !== "parsed") return;

        const expectedCount = Object.values(hooks).reduce(
          (sum, entries) => sum + entries.length,
          0,
        );
        expect(result.hooks).toHaveLength(expectedCount);
      }),
      { numRuns: 50 },
    );
  });
});
