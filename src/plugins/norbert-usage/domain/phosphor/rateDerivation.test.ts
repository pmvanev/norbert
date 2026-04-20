/**
 * Unit tests: rate-derivation helpers.
 *
 * Semantics (v2-phosphor-architecture §5 Q1):
 *   deriveEventsRate(count, windowMs, tickBoundaryT)
 *     = { t: tickBoundaryT, v: count / (windowMs / 1000) }
 *   deriveTokensRate(totalTokens, windowMs, tickBoundaryT)
 *     = { t: tickBoundaryT, v: totalTokens / (windowMs / 60000) }
 *     (per-minute units — Anthropic publishes rate limits as ITPM)
 *   deriveToolCallsRate(toolCallCount, windowMs, tickBoundaryT)
 *     = { t: tickBoundaryT, v: toolCallCount / (windowMs / 1000) }
 *   Zero-window lock: deriveTokensRate(_, 0, t) = { t, v: 0 }
 *     (defensive — prefer a safe sample over throwing, so pipelines do not
 *      crash on malformed OTel api-request events).
 *
 * Behaviors (one-test-per-behavior — property/example mix):
 *   deriveEventsRate:
 *     1. Reference example — 15 events over 5s yields 3 evt/s at the tick boundary.
 *     2. Zero events — count=0 yields v=0 regardless of window size.
 *     3. Fractional rate — counts not divisible by (windowMs/1000) yield fractional v.
 *     4. Boundary window — windowMs=1000 yields v=count (1-second window).
 *     5. Property: timestamp round-trip — the returned t always equals the input tickBoundaryT.
 *     6. Property: rate scales linearly with count for a fixed window.
 *
 *   deriveTokensRate:
 *     1. Reference example — 1000 tokens over a 60s window yields 1000 tok/min at t.
 *     2. Zero-window defensive lock — windowMs=0 yields v=0 (no throw).
 *     3. Zero tokens — totalTokens=0 yields v=0 regardless of window.
 *     4. Very-large totals — 10M tokens over 60s yields 10M tok/min (no overflow).
 *     5. Property: timestamp round-trip — returned t always equals input tickBoundaryT.
 *
 *   deriveToolCallsRate (mirrors deriveEventsRate — same windowed-counter shape):
 *     1. Reference example — 10 tool calls over 5s yields 2 calls/s at the tick boundary.
 *     2. Zero tool calls — toolCallCount=0 yields v=0 regardless of window size.
 *     3. Fractional rate — counts not divisible by (windowMs/1000) yield fractional v.
 *     4. Property: timestamp round-trip — returned t always equals input tickBoundaryT.
 *     5. Property: rate scales linearly with count for a fixed window.
 *
 * Pure: no effects. Each function under test is a total pure function of three
 * finite numbers. Port-to-port at domain scope: the public function signature
 * IS the port.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  deriveEventsRate,
  deriveTokensRate,
  deriveToolCallsRate,
} from "./rateDerivation";

describe("deriveEventsRate — reference example from IC-S1", () => {
  it("15 events over a 5-second window yields 3 evt/s at the tick boundary", () => {
    const sample = deriveEventsRate(15, 5000, 1_000_000_000);

    expect(sample.v).toBeCloseTo(3, 5);
    expect(sample.t).toBe(1_000_000_000);
  });
});

describe("deriveEventsRate — zero events", () => {
  it("a count of zero yields a rate of zero", () => {
    const sample = deriveEventsRate(0, 5000, 42);

    expect(sample.v).toBe(0);
    expect(sample.t).toBe(42);
  });
});

describe("deriveEventsRate — fractional rate", () => {
  it("12 events over a 5-second window yields a fractional 2.4 evt/s", () => {
    const sample = deriveEventsRate(12, 5000, 0);

    expect(sample.v).toBeCloseTo(2.4, 5);
    expect(sample.t).toBe(0);
  });
});

describe("deriveEventsRate — 1-second window boundary", () => {
  it("N events over a 1-second window yields N evt/s", () => {
    const sample = deriveEventsRate(7, 1000, 123_456);

    expect(sample.v).toBeCloseTo(7, 5);
    expect(sample.t).toBe(123_456);
  });
});

describe("deriveEventsRate — timestamp preservation (property)", () => {
  it("the returned t equals the input tickBoundaryT for any valid triplet", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 60_000 }),
        fc.integer({ min: 0, max: 2_000_000_000 }),
        (count, windowMs, tickBoundary) => {
          const sample = deriveEventsRate(count, windowMs, tickBoundary);
          expect(sample.t).toBe(tickBoundary);
        },
      ),
    );
  });
});

describe("deriveEventsRate — linear scaling with count (property)", () => {
  it("doubling the count doubles the rate for a fixed window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000 }),
        fc.integer({ min: 1_000, max: 60_000 }),
        fc.integer({ min: 0, max: 2_000_000_000 }),
        (count, windowMs, tickBoundary) => {
          const single = deriveEventsRate(count, windowMs, tickBoundary);
          const doubled = deriveEventsRate(count * 2, windowMs, tickBoundary);
          expect(doubled.v).toBeCloseTo(single.v * 2, 5);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// deriveTokensRate — windowed-counter semantics, per-minute units
//
// ITPM-relevant tokens (input + cache_creation) accumulated across the tick
// window, reported per minute so the axis maps directly to Anthropic's
// published ITPM limit.
// ---------------------------------------------------------------------------

describe("deriveTokensRate — reference example: one-minute window", () => {
  it("1000 tokens over a 60-second window yields 1000 tok/min at the tick boundary", () => {
    const sample = deriveTokensRate(1000, 60_000, 1_000_000_000);

    expect(sample.v).toBeCloseTo(1000, 5);
    expect(sample.t).toBe(1_000_000_000);
  });
});

describe("deriveTokensRate — 5-second window scales up to per-minute", () => {
  it("1000 tokens over a 5-second window yields 12000 tok/min", () => {
    const sample = deriveTokensRate(1000, 5000, 0);

    expect(sample.v).toBeCloseTo(12_000, 5);
    expect(sample.t).toBe(0);
  });
});

describe("deriveTokensRate — zero-window defensive lock", () => {
  it("a windowMs of zero yields a rate of zero (no throw)", () => {
    const sample = deriveTokensRate(500, 0, 42);

    expect(sample.v).toBe(0);
    expect(sample.t).toBe(42);
  });
});

describe("deriveTokensRate — zero tokens", () => {
  it("a totalTokens of zero yields a rate of zero regardless of window", () => {
    const sample = deriveTokensRate(0, 5000, 99);

    expect(sample.v).toBe(0);
    expect(sample.t).toBe(99);
  });
});

describe("deriveTokensRate — very-large totals", () => {
  it("10 million tokens over a 60-second window yields 10 million tok/min without overflow", () => {
    const sample = deriveTokensRate(10_000_000, 60_000, 7);

    expect(sample.v).toBeCloseTo(10_000_000, 0);
    expect(Number.isFinite(sample.v)).toBe(true);
    expect(sample.t).toBe(7);
  });
});

describe("deriveTokensRate — timestamp preservation (property)", () => {
  it("the returned t equals the input tickBoundaryT for any valid triplet", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.integer({ min: 0, max: 60_000 }),
        fc.integer({ min: 0, max: 2_000_000_000 }),
        (totalTokens, windowMs, tickBoundary) => {
          const sample = deriveTokensRate(totalTokens, windowMs, tickBoundary);
          expect(sample.t).toBe(tickBoundary);
          expect(Number.isFinite(sample.v)).toBe(true);
          expect(sample.v).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// deriveToolCallsRate — windowed-counter semantics (IC-S3)
//
// Mirrors deriveEventsRate: a windowed count divided by the window length in
// seconds. Shares the same purity and permissiveness contract — callers
// upstream guarantee windowMs > 0 and toolCallCount >= 0.
// ---------------------------------------------------------------------------

describe("deriveToolCallsRate — reference example from IC-S3", () => {
  it("10 tool calls over a 5-second window yields 2 calls/s at the tick boundary", () => {
    const sample = deriveToolCallsRate(10, 5000, 1_000_000_000);

    expect(sample.v).toBeCloseTo(2, 5);
    expect(sample.t).toBe(1_000_000_000);
  });
});

describe("deriveToolCallsRate — zero tool calls", () => {
  it("a count of zero yields a rate of zero", () => {
    const sample = deriveToolCallsRate(0, 5000, 42);

    expect(sample.v).toBe(0);
    expect(sample.t).toBe(42);
  });
});

describe("deriveToolCallsRate — fractional rate", () => {
  it("3 tool calls over a 5-second window yields a fractional 0.6 calls/s", () => {
    const sample = deriveToolCallsRate(3, 5000, 0);

    expect(sample.v).toBeCloseTo(0.6, 5);
    expect(sample.t).toBe(0);
  });
});

describe("deriveToolCallsRate — timestamp preservation (property)", () => {
  it("the returned t equals the input tickBoundaryT for any valid triplet", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.integer({ min: 1, max: 60_000 }),
        fc.integer({ min: 0, max: 2_000_000_000 }),
        (toolCallCount, windowMs, tickBoundary) => {
          const sample = deriveToolCallsRate(toolCallCount, windowMs, tickBoundary);
          expect(sample.t).toBe(tickBoundary);
        },
      ),
    );
  });
});

describe("deriveToolCallsRate — linear scaling with count (property)", () => {
  it("doubling the count doubles the rate for a fixed window", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000 }),
        fc.integer({ min: 1_000, max: 60_000 }),
        fc.integer({ min: 0, max: 2_000_000_000 }),
        (toolCallCount, windowMs, tickBoundary) => {
          const single = deriveToolCallsRate(toolCallCount, windowMs, tickBoundary);
          const doubled = deriveToolCallsRate(toolCallCount * 2, windowMs, tickBoundary);
          expect(doubled.v).toBeCloseTo(single.v * 2, 5);
        },
      ),
    );
  });
});
