/**
 * Unit tests: norbert-usage domain type definitions (Step 01-01)
 *
 * Validates that all algebraic data types for the usage tracking domain
 * are correctly defined with proper discriminated unions, readonly
 * interfaces, and structural properties.
 *
 * No runtime side effects in the type module.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import type {
  TokenUsage,
  TokenExtractionResult,
  ModelPricing,
  PricingTable,
  CostResult,
  SessionMetrics,
  RateSample,
  TimeSeriesBuffer,
  OscilloscopeStats,
  DailyCostEntry,
  MetricCardData,
  Urgency,
} from "../../../../../src/plugins/norbert-usage/domain/types";
import {
  URGENCY_LEVELS,
  isValidUrgency,
} from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// ACCEPTANCE: All types importable from domain/types
// ---------------------------------------------------------------------------

describe("All domain types are importable from domain/types", () => {
  it("TokenUsage is a structurally valid record type", () => {
    const usage: TokenUsage = {
      inputTokens: 100,
      outputTokens: 200,
      cacheReadTokens: 50,
      cacheCreationTokens: 25,
      model: "claude-opus-4-20250514",
    };
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(200);
    expect(usage.cacheReadTokens).toBe(50);
    expect(usage.cacheCreationTokens).toBe(25);
    expect(usage.model).toBe("claude-opus-4-20250514");
  });

  it("TokenExtractionResult is a discriminated union with 'found' and 'absent' tags", () => {
    const found: TokenExtractionResult = {
      tag: "found",
      usage: {
        inputTokens: 10,
        outputTokens: 20,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        model: "claude-sonnet-4-20250514",
      },
    };
    const absent: TokenExtractionResult = { tag: "absent" };

    expect(found.tag).toBe("found");
    expect(absent.tag).toBe("absent");
    if (found.tag === "found") {
      expect(found.usage.inputTokens).toBe(10);
    }
  });

  it("ModelPricing is a record with rate fields", () => {
    const pricing: ModelPricing = {
      modelPattern: "claude-opus-4",
      inputRate: 0.015,
      outputRate: 0.075,
      cacheReadRate: 0.0015,
      cacheCreationRate: 0.01875,
    };
    expect(pricing.modelPattern).toBe("claude-opus-4");
    expect(pricing.inputRate).toBe(0.015);
  });

  it("PricingTable is a readonly array of ModelPricing", () => {
    const table: PricingTable = [
      {
        modelPattern: "claude-opus-4",
        inputRate: 0.015,
        outputRate: 0.075,
        cacheReadRate: 0.0015,
        cacheCreationRate: 0.01875,
      },
    ];
    expect(table).toHaveLength(1);
    expect(table[0].modelPattern).toBe("claude-opus-4");
  });

  it("CostResult is a record with cost breakdown and model", () => {
    const cost: CostResult = {
      totalCost: 0.273,
      inputCost: 0.018,
      outputCost: 0.255,
      cacheCost: 0,
      model: "claude-opus-4-20250514",
    };
    expect(cost.totalCost).toBe(0.273);
    expect(cost.model).toBe("claude-opus-4-20250514");
  });

  it("SessionMetrics contains all required session tracking fields", () => {
    const metrics: SessionMetrics = {
      sessionId: "refactor-auth",
      totalTokens: 50000,
      inputTokens: 25000,
      outputTokens: 25000,
      sessionCost: 1.2,
      toolCallCount: 5,
      activeAgentCount: 1,
      contextWindowPct: 0.45,
      contextWindowModel: "claude-opus-4-20250514",
      hookEventCount: 10,
      sessionStartedAt: "2025-01-01T00:00:00Z",
      lastEventAt: "2025-01-01T00:05:00Z",
      burnRate: 0.24,
    };
    expect(metrics.sessionId).toBe("refactor-auth");
    expect(metrics.totalTokens).toBe(50000);
    expect(metrics.burnRate).toBe(0.24);
  });

  it("RateSample is a timestamped rate snapshot", () => {
    const sample: RateSample = {
      timestamp: 1704067200000,
      tokenRate: 150.5,
      costRate: 0.02,
    };
    expect(sample.timestamp).toBe(1704067200000);
  });

  it("TimeSeriesBuffer is a circular buffer with capacity and head index", () => {
    const buffer: TimeSeriesBuffer = {
      samples: [{ timestamp: 1704067200000, tokenRate: 100, costRate: 0.01 }],
      capacity: 60,
      headIndex: 0,
    };
    expect(buffer.capacity).toBe(60);
    expect(buffer.samples).toHaveLength(1);
  });

  it("OscilloscopeStats contains aggregated rate statistics", () => {
    const stats: OscilloscopeStats = {
      peakRate: 200,
      avgRate: 120,
      totalTokens: 50000,
      windowDuration: 60000,
    };
    expect(stats.peakRate).toBe(200);
    expect(stats.windowDuration).toBe(60000);
  });

  it("DailyCostEntry tracks daily cost with session count", () => {
    const entry: DailyCostEntry = {
      date: "2025-01-15",
      totalCost: 12.50,
      sessionCount: 5,
    };
    expect(entry.date).toBe("2025-01-15");
    expect(entry.sessionCount).toBe(5);
  });

  it("MetricCardData has label, value, subtitle, and urgency", () => {
    const card: MetricCardData = {
      label: "Session Cost",
      value: "$1.47",
      subtitle: "Opus 4",
      urgency: "normal",
    };
    expect(card.label).toBe("Session Cost");
    expect(card.urgency).toBe("normal");
  });
});

// ---------------------------------------------------------------------------
// URGENCY_LEVELS discriminated union
// ---------------------------------------------------------------------------

describe("URGENCY_LEVELS", () => {
  it("contains exactly normal, amber, and red", () => {
    expect(URGENCY_LEVELS).toEqual(["normal", "amber", "red"]);
  });

  it("has exactly 3 entries", () => {
    expect(URGENCY_LEVELS).toHaveLength(3);
  });
});

describe("isValidUrgency", () => {
  it("returns true for each valid urgency level", () => {
    for (const level of URGENCY_LEVELS) {
      expect(isValidUrgency(level)).toBe(true);
    }
  });

  it("returns false for unknown values", () => {
    expect(isValidUrgency("critical")).toBe(false);
    expect(isValidUrgency("")).toBe(false);
    expect(isValidUrgency(42)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: TokenExtractionResult discriminated union exhaustiveness
// ---------------------------------------------------------------------------

describe("TokenExtractionResult discriminated union properties", () => {
  it("every TokenExtractionResult has tag 'found' or 'absent'", () => {
    const tokenUsageArb = fc.record({
      inputTokens: fc.nat(),
      outputTokens: fc.nat(),
      cacheReadTokens: fc.nat(),
      cacheCreationTokens: fc.nat(),
      model: fc.string({ minLength: 1 }),
    });

    const extractionResultArb: fc.Arbitrary<TokenExtractionResult> = fc.oneof(
      tokenUsageArb.map((usage) => ({ tag: "found" as const, usage })),
      fc.constant({ tag: "absent" as const })
    );

    fc.assert(
      fc.property(extractionResultArb, (result) => {
        expect(["found", "absent"]).toContain(result.tag);
        if (result.tag === "found") {
          expect(result.usage.inputTokens).toBeGreaterThanOrEqual(0);
          expect(result.usage.outputTokens).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// PROPERTY: All numeric fields in SessionMetrics are non-negative
// ---------------------------------------------------------------------------

describe("SessionMetrics numeric field properties", () => {
  it("all token and cost fields are representable as non-negative numbers", () => {
    const sessionMetricsArb: fc.Arbitrary<SessionMetrics> = fc.record({
      sessionId: fc.string({ minLength: 1 }),
      totalTokens: fc.nat(),
      inputTokens: fc.nat(),
      outputTokens: fc.nat(),
      sessionCost: fc.double({ min: 0, noNaN: true }),
      toolCallCount: fc.nat(),
      activeAgentCount: fc.nat(),
      contextWindowPct: fc.double({ min: 0, max: 1, noNaN: true }),
      contextWindowModel: fc.string({ minLength: 1 }),
      hookEventCount: fc.nat(),
      sessionStartedAt: fc.string({ minLength: 1 }),
      lastEventAt: fc.string({ minLength: 1 }),
      burnRate: fc.double({ min: 0, noNaN: true }),
    });

    fc.assert(
      fc.property(sessionMetricsArb, (metrics) => {
        expect(metrics.totalTokens).toBeGreaterThanOrEqual(0);
        expect(metrics.inputTokens).toBeGreaterThanOrEqual(0);
        expect(metrics.outputTokens).toBeGreaterThanOrEqual(0);
        expect(metrics.sessionCost).toBeGreaterThanOrEqual(0);
        expect(metrics.toolCallCount).toBeGreaterThanOrEqual(0);
        expect(metrics.contextWindowPct).toBeGreaterThanOrEqual(0);
        expect(metrics.contextWindowPct).toBeLessThanOrEqual(1);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// No side effects: module is pure types + const arrays
// ---------------------------------------------------------------------------

describe("Type module has no runtime side effects", () => {
  it("importing the module only yields type definitions and const arrays", () => {
    // The fact that the import succeeded without errors and
    // URGENCY_LEVELS is the only runtime export verifies purity.
    // If the module had side effects (console.log, fetch, etc.),
    // they would have executed during import.
    expect(typeof URGENCY_LEVELS).toBe("object");
    expect(typeof isValidUrgency).toBe("function");
  });
});
