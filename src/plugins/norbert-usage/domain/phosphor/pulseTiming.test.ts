/**
 * Unit tests: pulseTiming — pure helpers for pulse lifetime + store retention.
 *
 * Two behaviors under test:
 *
 *   1. `decayFactor(ageMs, lifetimeMs)` — linear decay from 1 (fresh) to 0
 *      (at lifetime boundary); clamps outside [0, lifetime] so callers cannot
 *      produce negative decay or decay > 1.
 *   2. `prunePulses(log, now, cutoffMs)` — returns a NEW readonly array of
 *      pulses whose age `(now - p.t)` is within the cutoff. Never mutates
 *      the input log; idempotent when re-applied with the same (now, cutoffMs).
 *
 * Pure: no effects, no imports outside `phosphorMetricConfig`.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { decayFactor, prunePulses } from "./pulseTiming";
import { PULSE_LIFETIME_MS, type Pulse } from "./phosphorMetricConfig";

// ---------------------------------------------------------------------------
// decayFactor — the age→[0,1] mapping
// ---------------------------------------------------------------------------

describe("decayFactor — age to decay mapping", () => {
  it("covers the three boundary cases and the clamp", () => {
    // age = 0 → fully fresh (1)
    expect(decayFactor(0, PULSE_LIFETIME_MS)).toBe(1);

    // age equal to lifetime → fully decayed (0)
    expect(decayFactor(PULSE_LIFETIME_MS, PULSE_LIFETIME_MS)).toBe(0);

    // age past lifetime → clamped to 0
    expect(decayFactor(PULSE_LIFETIME_MS + 1_000, PULSE_LIFETIME_MS)).toBe(0);

    // negative age (clock skew / pulse at future timestamp) → clamped to 1
    expect(decayFactor(-500, PULSE_LIFETIME_MS)).toBe(1);
  });

  it("linearly interpolates between 1 and 0 across [0, lifetime]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 100, max: 10_000 }),
        (fraction, lifetime) => {
          const age = fraction * lifetime;
          const decay = decayFactor(age, lifetime);
          expect(decay).toBeCloseTo(1 - fraction, 6);
        },
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// prunePulses — retention trim, immutability, idempotence
// ---------------------------------------------------------------------------

describe("prunePulses — retention-based trim", () => {
  const NOW = 1_000_000_000;
  const CUTOFF = 5_000;
  const pulse = (ageMs: number): Pulse => ({
    t: NOW - ageMs,
    kind: "tool",
    strength: 1,
  });

  it("retains fresh pulses and drops pulses older than the cutoff", () => {
    const log: ReadonlyArray<Pulse> = [
      pulse(0),        // fresh
      pulse(2_500),    // within cutoff
      pulse(5_000),    // at cutoff — still retained (age <= cutoff)
      pulse(5_001),    // past cutoff — dropped
      pulse(30_000),   // long-expired — dropped
    ];

    const kept = prunePulses(log, NOW, CUTOFF);

    expect(kept).toHaveLength(3);
    expect(kept.map((p) => NOW - p.t)).toEqual([0, 2_500, 5_000]);
  });

  it("returns a new array without mutating the input, and is idempotent", () => {
    const original: ReadonlyArray<Pulse> = [pulse(1_000), pulse(8_000), pulse(2_000)];
    const snapshot = [...original];

    const first = prunePulses(original, NOW, CUTOFF);

    // input not mutated
    expect(original).toEqual(snapshot);
    // returned array is a distinct instance
    expect(first).not.toBe(original);

    // idempotence: re-applying with the same (now, cutoff) returns an equivalent set
    const second = prunePulses(first, NOW, CUTOFF);
    expect(second).toEqual(first);
  });
});
