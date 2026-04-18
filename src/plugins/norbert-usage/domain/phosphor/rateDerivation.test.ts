/**
 * Unit tests: deriveEventsRate — windowed event-count to events-per-second sample.
 *
 * Semantics (v2-phosphor-architecture §5 Q1):
 *   deriveEventsRate(count, windowMs, tickBoundaryT)
 *     = { t: tickBoundaryT, v: count / (windowMs / 1000) }
 *
 * Behaviors (one-test-per-behavior — property/example mix):
 *   1. Reference example — 15 events over 5s yields 3 evt/s at the tick boundary.
 *   2. Zero events — count=0 yields v=0 regardless of window size.
 *   3. Fractional rate — counts not divisible by (windowMs/1000) yield fractional v.
 *   4. Boundary window — windowMs=1000 yields v=count (1-second window).
 *   5. Property: timestamp round-trip — the returned t always equals the input tickBoundaryT.
 *   6. Property: rate scales linearly with count for a fixed window.
 *
 * Pure: no effects. The function under test is a total pure function of three
 * finite numbers. Port-to-port at domain scope: the public function signature
 * IS the port.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { deriveEventsRate } from "./rateDerivation";

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
