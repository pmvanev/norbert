/**
 * Unit tests: instantaneous rate computation.
 *
 * Tests the pure function that computes token and cost rates from
 * consecutive metric snapshots (delta-based, not cumulative averages).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  computeInstantaneousRates,
  type MetricsSnapshot,
} from "../../../../../src/plugins/norbert-usage/domain/instantaneousRate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const snap = (totalTokens: number, sessionCost: number, timestamp: number): MetricsSnapshot => ({
  totalTokens,
  sessionCost,
  timestamp,
});

// ---------------------------------------------------------------------------
// Example-based tests
// ---------------------------------------------------------------------------

describe("computeInstantaneousRates", () => {
  it("computes 500 tok/s from 1000 token delta over 2 seconds", () => {
    const previous = snap(0, 0, 1000);
    const current = snap(1000, 0.15, 3000);

    const rates = computeInstantaneousRates(current, previous);

    expect(rates.tokenRate).toBeCloseTo(500, 5);
    expect(rates.costRate).toBeCloseTo(0.075, 5);
  });

  it("returns zero rate when no token delta", () => {
    const previous = snap(5000, 1.5, 1000);
    const current = snap(5000, 1.5, 3000);

    const rates = computeInstantaneousRates(current, previous);

    expect(rates.tokenRate).toBe(0);
    expect(rates.costRate).toBe(0);
  });

  it("floors negative deltas at zero", () => {
    // Metric reset scenario
    const previous = snap(5000, 1.5, 1000);
    const current = snap(0, 0, 2000);

    const rates = computeInstantaneousRates(current, previous);

    expect(rates.tokenRate).toBe(0);
    expect(rates.costRate).toBe(0);
  });

  it("handles zero delta time without division by zero", () => {
    const previous = snap(0, 0, 1000);
    const current = snap(100, 0.01, 1000);

    const rates = computeInstantaneousRates(current, previous);

    expect(Number.isFinite(rates.tokenRate)).toBe(true);
    expect(Number.isFinite(rates.costRate)).toBe(true);
    expect(rates.tokenRate).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Property-based tests
// ---------------------------------------------------------------------------

const snapshotArb = fc
  .record({
    totalTokens: fc.integer({ min: 0, max: 10_000_000 }),
    sessionCost: fc.integer({ min: 0, max: 100_000 }).map((n) => n / 100),
    timestamp: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  });

describe("computeInstantaneousRates properties", () => {
  it("rates are always non-negative for non-decreasing totals", () => {
    fc.assert(
      fc.property(snapshotArb, snapshotArb, (a, b) => {
        // Ensure b >= a in totals and timestamp
        const previous = { ...a, timestamp: Math.min(a.timestamp, b.timestamp) };
        const current = {
          totalTokens: Math.max(a.totalTokens, b.totalTokens),
          sessionCost: Math.max(a.sessionCost, b.sessionCost),
          timestamp: Math.max(a.timestamp, b.timestamp),
        };

        const rates = computeInstantaneousRates(current, previous);

        expect(rates.tokenRate).toBeGreaterThanOrEqual(0);
        expect(rates.costRate).toBeGreaterThanOrEqual(0);
      }),
    );
  });

  it("rates are always finite", () => {
    fc.assert(
      fc.property(snapshotArb, snapshotArb, (a, b) => {
        const rates = computeInstantaneousRates(a, b);

        expect(Number.isFinite(rates.tokenRate)).toBe(true);
        expect(Number.isFinite(rates.costRate)).toBe(true);
      }),
    );
  });
});
