/**
 * Unit tests: Burn Rate Calculator (Step 02-01)
 *
 * Pure function: (events: Array<{timestamp, tokens}>, windowSeconds) => number
 *
 * Properties tested:
 * - Empty array returns 0
 * - Events outside window return 0
 * - Single event within window returns tokens / windowSeconds
 * - Result is always non-negative
 * - More tokens in window means higher or equal burn rate
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { calculateBurnRate } from "../../../../../src/plugins/norbert-usage/domain/burnRate";

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const tokenEventArb = fc.record({
  timestamp: fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
  tokens: fc.nat({ max: 100_000 }),
});

const windowSecondsArb = fc.integer({ min: 1, max: 3600 });

// ---------------------------------------------------------------------------
// Empty input
// ---------------------------------------------------------------------------

describe("calculateBurnRate with empty events", () => {
  it("returns 0 for empty array", () => {
    fc.assert(
      fc.property(windowSecondsArb, (window) => {
        expect(calculateBurnRate([], window)).toBe(0);
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Events outside window
// ---------------------------------------------------------------------------

describe("calculateBurnRate with all events outside window", () => {
  it("returns 0 when all events are before the window", () => {
    const now = 1_700_000_000;
    const windowSeconds = 60;
    const oldEvents = [
      { timestamp: now - 120, tokens: 500 },
      { timestamp: now - 180, tokens: 300 },
    ];
    expect(calculateBurnRate(oldEvents, windowSeconds, now)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Single event within window
// ---------------------------------------------------------------------------

describe("calculateBurnRate with single event in window", () => {
  it("returns tokens divided by window seconds", () => {
    const now = 1_700_000_000;
    const windowSeconds = 60;
    const events = [{ timestamp: now - 10, tokens: 600 }];
    expect(calculateBurnRate(events, windowSeconds, now)).toBeCloseTo(600 / 60, 5);
  });
});

// ---------------------------------------------------------------------------
// Multiple events, some in window
// ---------------------------------------------------------------------------

describe("calculateBurnRate with mixed events", () => {
  it("only counts tokens from events within the window", () => {
    const now = 1_700_000_000;
    const windowSeconds = 60;
    const events = [
      { timestamp: now - 10, tokens: 400 },   // in window
      { timestamp: now - 30, tokens: 200 },   // in window
      { timestamp: now - 120, tokens: 9999 }, // outside window
    ];
    expect(calculateBurnRate(events, windowSeconds, now)).toBeCloseTo(600 / 60, 5);
  });
});

// ---------------------------------------------------------------------------
// Property: result is always non-negative
// ---------------------------------------------------------------------------

describe("burn rate is always non-negative", () => {
  it("for any events and window, result >= 0", () => {
    fc.assert(
      fc.property(
        fc.array(tokenEventArb, { maxLength: 50 }),
        windowSecondsArb,
        (events, window) => {
          const result = calculateBurnRate(events, window);
          expect(result).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Property: more tokens in window => higher or equal burn rate
// ---------------------------------------------------------------------------

describe("adding tokens to window increases burn rate", () => {
  it("adding an event within window produces >= burn rate", () => {
    fc.assert(
      fc.property(
        fc.array(tokenEventArb, { maxLength: 10 }),
        windowSecondsArb,
        fc.nat({ max: 100_000 }),
        (events, window, extraTokens) => {
          const now = 2_000_000_000;
          const baseBurnRate = calculateBurnRate(events, window, now);
          const augmented = [...events, { timestamp: now - 1, tokens: extraTokens }];
          const newBurnRate = calculateBurnRate(augmented, window, now);
          expect(newBurnRate).toBeGreaterThanOrEqual(baseBurnRate);
        },
      ),
    );
  });
});
