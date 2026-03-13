/**
 * Unit tests: Token Extractor (Step 01-02)
 *
 * Pure function: (payload: unknown) => TokenExtractionResult
 *
 * Properties tested:
 * - Valid payloads always produce 'found' with correct token counts
 * - Cache tokens default to 0 when absent
 * - Payloads without usage field produce 'absent'
 * - Zero tokens are never fabricated from missing data
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { extractTokenUsage } from "../../../../../src/plugins/norbert-usage/domain/tokenExtractor";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const tokenCountArb = fc.nat({ max: 1_000_000 });
const modelArb = fc.string({ minLength: 1, maxLength: 80 });

const validUsagePayloadArb = fc.record({
  input_tokens: tokenCountArb,
  output_tokens: tokenCountArb,
  model: modelArb,
});

const validUsageWithCacheArb = fc.record({
  input_tokens: tokenCountArb,
  output_tokens: tokenCountArb,
  model: modelArb,
  cache_read_input_tokens: tokenCountArb,
  cache_creation_input_tokens: tokenCountArb,
});

// ---------------------------------------------------------------------------
// PROPERTY: Valid payloads always produce 'found'
// ---------------------------------------------------------------------------

describe("extractTokenUsage with valid usage payloads", () => {
  it("always returns 'found' with matching token counts for any valid payload", () => {
    fc.assert(
      fc.property(validUsagePayloadArb, (usage) => {
        const result = extractTokenUsage({ usage });

        expect(result.tag).toBe("found");
        if (result.tag === "found") {
          expect(result.usage.inputTokens).toBe(usage.input_tokens);
          expect(result.usage.outputTokens).toBe(usage.output_tokens);
          expect(result.usage.model).toBe(usage.model);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("defaults cache tokens to 0 when not present in payload", () => {
    fc.assert(
      fc.property(validUsagePayloadArb, (usage) => {
        const result = extractTokenUsage({ usage });

        expect(result.tag).toBe("found");
        if (result.tag === "found") {
          expect(result.usage.cacheReadTokens).toBe(0);
          expect(result.usage.cacheCreationTokens).toBe(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("extracts cache tokens when present in payload", () => {
    fc.assert(
      fc.property(validUsageWithCacheArb, (usage) => {
        const result = extractTokenUsage({ usage });

        expect(result.tag).toBe("found");
        if (result.tag === "found") {
          expect(result.usage.cacheReadTokens).toBe(
            usage.cache_read_input_tokens,
          );
          expect(result.usage.cacheCreationTokens).toBe(
            usage.cache_creation_input_tokens,
          );
        }
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: Invalid payloads always produce 'absent'
// ---------------------------------------------------------------------------

describe("extractTokenUsage with missing or invalid usage data", () => {
  it("returns 'absent' when payload has no usage field", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant({}),
          fc.constant({ other: "data" }),
          fc.record({ name: fc.string() }),
        ),
        (payload) => {
          const result = extractTokenUsage(payload);
          expect(result.tag).toBe("absent");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns 'absent' for null and undefined payloads", () => {
    expect(extractTokenUsage(null).tag).toBe("absent");
    expect(extractTokenUsage(undefined).tag).toBe("absent");
  });

  it("returns 'absent' for non-object payloads", () => {
    expect(extractTokenUsage(42).tag).toBe("absent");
    expect(extractTokenUsage("hello").tag).toBe("absent");
    expect(extractTokenUsage(true).tag).toBe("absent");
  });

  it("returns 'absent' when usage exists but required fields are missing", () => {
    // Missing input_tokens
    expect(
      extractTokenUsage({ usage: { output_tokens: 10, model: "m" } }).tag,
    ).toBe("absent");
    // Missing output_tokens
    expect(
      extractTokenUsage({ usage: { input_tokens: 10, model: "m" } }).tag,
    ).toBe("absent");
    // Missing model
    expect(
      extractTokenUsage({ usage: { input_tokens: 10, output_tokens: 10 } }).tag,
    ).toBe("absent");
  });

  it("returns 'absent' when usage fields have wrong types", () => {
    expect(
      extractTokenUsage({
        usage: { input_tokens: "not a number", output_tokens: 10, model: "m" },
      }).tag,
    ).toBe("absent");
    expect(
      extractTokenUsage({
        usage: { input_tokens: 10, output_tokens: "bad", model: "m" },
      }).tag,
    ).toBe("absent");
    expect(
      extractTokenUsage({
        usage: { input_tokens: 10, output_tokens: 10, model: 42 },
      }).tag,
    ).toBe("absent");
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: Zero tokens never fabricated from missing data
// ---------------------------------------------------------------------------

describe("extractTokenUsage never fabricates zero tokens", () => {
  it("absent result has no usage property with zero values", () => {
    const result = extractTokenUsage({ session_id: "s1" });
    expect(result.tag).toBe("absent");
    // The absent variant should NOT have a usage field
    expect("usage" in result).toBe(false);
  });
});
