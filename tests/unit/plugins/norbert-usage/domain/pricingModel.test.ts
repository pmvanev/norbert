/**
 * Unit tests: Pricing Model (Step 01-03)
 *
 * Pure function: (usage: TokenUsage, table: PricingTable) => CostResult
 *
 * Properties tested:
 * - Total cost equals sum of input, output, and cache costs
 * - All cost components are non-negative for non-negative token counts
 * - Model pattern prefix matching selects correct tier
 * - Unknown models fall back to most expensive (Opus) rates
 * - Zero tokens produce zero cost
 * - Cost scales linearly with token count
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  calculateCost,
  DEFAULT_PRICING_TABLE,
} from "../../../../../src/plugins/norbert-usage/domain/pricingModel";
import type {
  TokenUsage,
  PricingTable,
} from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const tokenCountArb = fc.nat({ max: 1_000_000 });

const opusModelArb = fc.constant("claude-opus-4-20250514");
const sonnetModelArb = fc.constant("claude-sonnet-4-20250514");
const haikuModelArb = fc.constant("claude-haiku-3-5-20241022");
const unknownModelArb = fc.constantFrom(
  "claude-unknown-model-v99",
  "gpt-4o",
  "totally-random-model",
);

const knownModelArb = fc.oneof(opusModelArb, sonnetModelArb, haikuModelArb);

const tokenUsageArb = (modelArb: fc.Arbitrary<string>) =>
  fc.record({
    inputTokens: tokenCountArb,
    outputTokens: tokenCountArb,
    cacheReadTokens: tokenCountArb,
    cacheCreationTokens: tokenCountArb,
    model: modelArb,
  });

// ---------------------------------------------------------------------------
// PROPERTY: Total cost equals sum of components
// ---------------------------------------------------------------------------

describe("calculateCost total equals sum of components", () => {
  it("totalCost always equals inputCost + outputCost + cacheCost", () => {
    fc.assert(
      fc.property(tokenUsageArb(knownModelArb), (usage) => {
        const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

        expect(cost.totalCost).toBeCloseTo(
          cost.inputCost + cost.outputCost + cost.cacheCost,
          10,
        );
      }),
      { numRuns: 500 },
    );
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: All cost components are non-negative
// ---------------------------------------------------------------------------

describe("calculateCost produces non-negative costs", () => {
  it("all cost components are >= 0 for any non-negative token counts", () => {
    fc.assert(
      fc.property(tokenUsageArb(knownModelArb), (usage) => {
        const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

        expect(cost.totalCost).toBeGreaterThanOrEqual(0);
        expect(cost.inputCost).toBeGreaterThanOrEqual(0);
        expect(cost.outputCost).toBeGreaterThanOrEqual(0);
        expect(cost.cacheCost).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: Zero tokens produce zero cost
// ---------------------------------------------------------------------------

describe("calculateCost with zero tokens", () => {
  it("produces zero cost when all token counts are zero", () => {
    fc.assert(
      fc.property(knownModelArb, (model) => {
        const usage: TokenUsage = {
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          model,
        };
        const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

        expect(cost.totalCost).toBe(0);
        expect(cost.inputCost).toBe(0);
        expect(cost.outputCost).toBe(0);
        expect(cost.cacheCost).toBe(0);
      }),
      { numRuns: 50 },
    );
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: Cost scales linearly with token count
// ---------------------------------------------------------------------------

describe("calculateCost scales linearly", () => {
  it("doubling all token counts doubles the total cost", () => {
    fc.assert(
      fc.property(
        tokenUsageArb(knownModelArb).filter(
          (u) =>
            u.inputTokens > 0 ||
            u.outputTokens > 0 ||
            u.cacheReadTokens > 0 ||
            u.cacheCreationTokens > 0,
        ),
        (usage) => {
          const singleCost = calculateCost(usage, DEFAULT_PRICING_TABLE);
          const doubledUsage: TokenUsage = {
            ...usage,
            inputTokens: usage.inputTokens * 2,
            outputTokens: usage.outputTokens * 2,
            cacheReadTokens: usage.cacheReadTokens * 2,
            cacheCreationTokens: usage.cacheCreationTokens * 2,
          };
          const doubleCost = calculateCost(doubledUsage, DEFAULT_PRICING_TABLE);

          expect(doubleCost.totalCost).toBeCloseTo(
            singleCost.totalCost * 2,
            6,
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE: Opus 4 pricing calculation
// ---------------------------------------------------------------------------

describe("calculateCost with Opus 4 model", () => {
  it("computes correct cost for 1200 input and 3400 output tokens", () => {
    const usage: TokenUsage = {
      inputTokens: 1200,
      outputTokens: 3400,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: "claude-opus-4-20250514",
    };

    const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

    // input: 1200 * $0.015/1k = $0.018
    expect(cost.inputCost).toBeCloseTo(0.018, 4);
    // output: 3400 * $0.075/1k = $0.255
    expect(cost.outputCost).toBeCloseTo(0.255, 4);
    expect(cost.totalCost).toBeCloseTo(0.273, 4);
    expect(cost.model).toBe("claude-opus-4-20250514");
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE: Sonnet 4 pricing calculation
// ---------------------------------------------------------------------------

describe("calculateCost with Sonnet 4 model", () => {
  it("computes correct cost for 800 input and 2000 output tokens", () => {
    const usage: TokenUsage = {
      inputTokens: 800,
      outputTokens: 2000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: "claude-sonnet-4-20250514",
    };

    const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

    // input: 800 * $0.003/1k = $0.0024
    expect(cost.inputCost).toBeCloseTo(0.0024, 4);
    // output: 2000 * $0.015/1k = $0.030
    expect(cost.outputCost).toBeCloseTo(0.03, 4);
    expect(cost.totalCost).toBeCloseTo(0.0324, 4);
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE: Cache token pricing
// ---------------------------------------------------------------------------

describe("calculateCost with cache tokens", () => {
  it("includes cache read and creation costs at model-specific rates", () => {
    const usage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 2000,
      cacheReadTokens: 5000,
      cacheCreationTokens: 1000,
      model: "claude-opus-4-20250514",
    };

    const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

    // cache read: 5000 * $0.0015/1k = $0.0075
    // cache creation: 1000 * $0.01875/1k = $0.01875
    expect(cost.cacheCost).toBeCloseTo(0.02625, 4);
    const expectedTotal = 0.015 + 0.15 + 0.0075 + 0.01875;
    expect(cost.totalCost).toBeCloseTo(expectedTotal, 4);
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE: Unknown model fallback
// ---------------------------------------------------------------------------

describe("calculateCost with unknown model", () => {
  it("falls back to most expensive (Opus) rates for unrecognized models", () => {
    fc.assert(
      fc.property(unknownModelArb, (model) => {
        const usage: TokenUsage = {
          inputTokens: 1000,
          outputTokens: 1000,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          model,
        };

        const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);

        // Opus rates: input $0.015/1k, output $0.075/1k
        expect(cost.inputCost).toBeCloseTo(0.015, 4);
        expect(cost.outputCost).toBeCloseTo(0.075, 4);
        expect(cost.totalCost).toBeCloseTo(0.09, 4);
      }),
      { numRuns: 10 },
    );
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE: Model preserved in CostResult
// ---------------------------------------------------------------------------

describe("calculateCost preserves model in result", () => {
  it("CostResult.model matches TokenUsage.model", () => {
    fc.assert(
      fc.property(
        tokenUsageArb(fc.oneof(knownModelArb, unknownModelArb)),
        (usage) => {
          const cost = calculateCost(usage, DEFAULT_PRICING_TABLE);
          expect(cost.model).toBe(usage.model);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// EXAMPLE: Prefix matching selects correct tier
// ---------------------------------------------------------------------------

describe("calculateCost prefix matching", () => {
  it("selects first matching tier by prefix", () => {
    const customTable: PricingTable = [
      {
        modelPattern: "claude-opus",
        inputRate: 0.015,
        outputRate: 0.075,
        cacheReadRate: 0.0015,
        cacheCreationRate: 0.01875,
      },
      {
        modelPattern: "",
        inputRate: 0.001,
        outputRate: 0.005,
        cacheReadRate: 0.0001,
        cacheCreationRate: 0.00125,
      },
    ];

    const opusUsage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      model: "claude-opus-4-20250514",
    };

    const cost = calculateCost(opusUsage, customTable);
    // Matches "claude-opus" prefix -> $0.015/1k
    expect(cost.inputCost).toBeCloseTo(0.015, 4);
  });
});
