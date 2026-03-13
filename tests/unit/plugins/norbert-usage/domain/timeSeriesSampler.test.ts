/**
 * Unit tests: Time-Series Sampler (Step 02-02)
 *
 * Pure functions operating on immutable TimeSeriesBuffer:
 * - createBuffer: creates empty buffer with given capacity
 * - appendSample: returns new buffer with sample appended, evicts oldest if full
 * - getSamples: returns samples in insertion order
 * - computeStats: computes peak rate, average rate, total tokens, window duration
 *
 * Properties tested:
 * - Buffer size never exceeds capacity
 * - Samples returned in insertion order
 * - appendSample is pure (original buffer unchanged)
 * - computeStats.peakRate >= computeStats.avgRate
 * - computeStats values are always non-negative
 * - totalTokens equals sum of all tokenRates in buffer
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  createBuffer,
  appendSample,
  getSamples,
  computeStats,
} from "../../../../../src/plugins/norbert-usage/domain/timeSeriesSampler";
import type { RateSample } from "../../../../../src/plugins/norbert-usage/domain/types";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const rateSampleArb = fc.record({
  timestamp: fc.integer({ min: 0, max: 10_000_000 }),
  tokenRate: fc.nat({ max: 10_000 }),
  costRate: fc.double({ min: 0, max: 10, noNaN: true }),
});

const capacityArb = fc.integer({ min: 1, max: 1000 });

// ---------------------------------------------------------------------------
// createBuffer
// ---------------------------------------------------------------------------

describe("createBuffer", () => {
  it("creates an empty buffer with given capacity", () => {
    fc.assert(
      fc.property(capacityArb, (capacity) => {
        const buffer = createBuffer(capacity);
        expect(getSamples(buffer)).toHaveLength(0);
        expect(buffer.capacity).toBe(capacity);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// appendSample — size invariant
// ---------------------------------------------------------------------------

describe("appendSample size invariant", () => {
  it("buffer size never exceeds capacity", () => {
    fc.assert(
      fc.property(
        capacityArb,
        fc.array(rateSampleArb, { minLength: 1, maxLength: 200 }),
        (capacity, samples) => {
          let buffer = createBuffer(capacity);
          for (const s of samples) {
            buffer = appendSample(buffer, s);
          }
          expect(getSamples(buffer).length).toBeLessThanOrEqual(capacity);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// appendSample — immutability
// ---------------------------------------------------------------------------

describe("appendSample immutability", () => {
  it("original buffer is not mutated", () => {
    const buffer = createBuffer(10);
    const sample: RateSample = { timestamp: 1000, tokenRate: 42, costRate: 0.01 };
    const original = getSamples(buffer);
    appendSample(buffer, sample);
    expect(getSamples(buffer)).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// appendSample — eviction
// ---------------------------------------------------------------------------

describe("appendSample eviction", () => {
  it("evicts oldest sample when buffer is full", () => {
    let buffer = createBuffer(3);
    const s1: RateSample = { timestamp: 100, tokenRate: 1, costRate: 0 };
    const s2: RateSample = { timestamp: 200, tokenRate: 2, costRate: 0 };
    const s3: RateSample = { timestamp: 300, tokenRate: 3, costRate: 0 };
    const s4: RateSample = { timestamp: 400, tokenRate: 4, costRate: 0 };

    buffer = appendSample(buffer, s1);
    buffer = appendSample(buffer, s2);
    buffer = appendSample(buffer, s3);
    buffer = appendSample(buffer, s4);

    const samples = getSamples(buffer);
    expect(samples).toHaveLength(3);
    expect(samples[0].timestamp).toBe(200); // s1 evicted
    expect(samples[2].timestamp).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// getSamples — insertion order
// ---------------------------------------------------------------------------

describe("getSamples returns insertion order", () => {
  it("samples are ordered by insertion sequence", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 50 }),
        fc.array(rateSampleArb, { minLength: 2, maxLength: 100 }),
        (capacity, samples) => {
          let buffer = createBuffer(capacity);
          for (const s of samples) {
            buffer = appendSample(buffer, s);
          }
          const result = getSamples(buffer);
          // Last N samples (where N = min(samples.length, capacity))
          const expectedCount = Math.min(samples.length, capacity);
          expect(result).toHaveLength(expectedCount);

          // Verify order matches tail of input
          const tail = samples.slice(samples.length - expectedCount);
          for (let i = 0; i < result.length; i++) {
            expect(result[i]).toEqual(tail[i]);
          }
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// computeStats — zero samples
// ---------------------------------------------------------------------------

describe("computeStats with empty buffer", () => {
  it("returns zero stats for empty buffer", () => {
    const buffer = createBuffer(600);
    const stats = computeStats(buffer);
    expect(stats.peakRate).toBe(0);
    expect(stats.avgRate).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.windowDuration).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeStats — peak >= average (property)
// ---------------------------------------------------------------------------

describe("computeStats peak >= average", () => {
  it("peak rate is always >= average rate", () => {
    fc.assert(
      fc.property(
        fc.array(rateSampleArb, { minLength: 1, maxLength: 100 }),
        (samples) => {
          let buffer = createBuffer(600);
          for (const s of samples) {
            buffer = appendSample(buffer, s);
          }
          const stats = computeStats(buffer);
          expect(stats.peakRate).toBeGreaterThanOrEqual(stats.avgRate);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// computeStats — non-negative values (property)
// ---------------------------------------------------------------------------

describe("computeStats values are non-negative", () => {
  it("all stat values are >= 0", () => {
    fc.assert(
      fc.property(
        fc.array(rateSampleArb, { maxLength: 100 }),
        (samples) => {
          let buffer = createBuffer(600);
          for (const s of samples) {
            buffer = appendSample(buffer, s);
          }
          const stats = computeStats(buffer);
          expect(stats.peakRate).toBeGreaterThanOrEqual(0);
          expect(stats.avgRate).toBeGreaterThanOrEqual(0);
          expect(stats.totalTokens).toBeGreaterThanOrEqual(0);
          expect(stats.windowDuration).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// computeStats — totalTokens equals sum of tokenRates
// ---------------------------------------------------------------------------

describe("computeStats totalTokens", () => {
  it("totalTokens equals sum of all tokenRates in buffer", () => {
    fc.assert(
      fc.property(
        fc.array(rateSampleArb, { minLength: 1, maxLength: 50 }),
        (samples) => {
          let buffer = createBuffer(600);
          for (const s of samples) {
            buffer = appendSample(buffer, s);
          }
          const result = getSamples(buffer);
          const expectedTotal = result.reduce((acc, s) => acc + s.tokenRate, 0);
          const stats = computeStats(buffer);
          expect(stats.totalTokens).toBe(expectedTotal);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// computeStats — windowDuration
// ---------------------------------------------------------------------------

describe("computeStats windowDuration", () => {
  it("windowDuration is difference between last and first timestamp", () => {
    let buffer = createBuffer(600);
    const s1: RateSample = { timestamp: 1000, tokenRate: 10, costRate: 0 };
    const s2: RateSample = { timestamp: 3000, tokenRate: 20, costRate: 0 };
    const s3: RateSample = { timestamp: 5000, tokenRate: 30, costRate: 0 };

    buffer = appendSample(buffer, s1);
    buffer = appendSample(buffer, s2);
    buffer = appendSample(buffer, s3);

    const stats = computeStats(buffer);
    expect(stats.windowDuration).toBe(4000);
  });
});
