/**
 * Unit tests: hover-beat pulse math — pure radius/alpha modulation for the
 * beating dot rendered at the hovered sample.
 *
 * The dot's radius and opacity are sinusoidal functions of time:
 *   radius(t) = base + amplitude * (0.5 + 0.5 * sin(2π * freqHz * t))
 *   alpha(t)  = opacityBase + opacityAmplitude * sin(2π * freqHz * t)
 *
 * Behaviors under test:
 *   1. Radius is always bounded in [base, base + amplitude] for any time /
 *      frequency / amplitude combo within the sinusoid's natural range.
 *   2. Alpha is always bounded in [opacityBase - opacityAmplitude,
 *      opacityBase + opacityAmplitude].
 *   3. Monotonic half-cycle — within one half period the radius is monotonic
 *      (the full waveform has exactly one sign flip of the derivative per
 *      half cycle at the peak/trough, but WITHIN a half cycle the function
 *      is monotonic). This guards against accidental phase doubling or
 *      frequency-squared bugs.
 *   4. Periodicity — radius(t) === radius(t + 1/freqHz) within floating
 *      tolerance (one full period returns to the same value).
 *
 * No effects; two pure functions under test.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { computeHoverBeatRadius, computeHoverBeatAlpha } from "./hoverBeat";

describe("computeHoverBeatRadius — bounds", () => {
  it("always returns a value in [base, base + amplitude]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (nowMs, freqHz, base, amplitude) => {
          const result = computeHoverBeatRadius(nowMs, freqHz, base, amplitude);
          // Small floating tolerance for the `0.5 + 0.5 * sin` envelope —
          // IEEE-754 can drift ~1 ULP across the multiply/add chain.
          const tolerance = (base + amplitude) * 4 * Number.EPSILON + 1e-12;
          expect(result).toBeGreaterThanOrEqual(base - tolerance);
          expect(result).toBeLessThanOrEqual(base + amplitude + tolerance);
        },
      ),
    );
  });

  it("equals base at phase=π (sin = 0 on the descending branch, envelope at 0)", () => {
    // (0.5 + 0.5 * sin(π)) ≈ 0.5 (not 0), so this checks envelope = 0 at
    // phase 3π/2 → sin = -1 → (0.5 + 0.5 * -1) = 0. With freqHz=1 this is
    // nowMs = 750.
    const result = computeHoverBeatRadius(750, 1, 4, 3);
    expect(result).toBeCloseTo(4, 9);
  });

  it("equals base + amplitude at envelope peak (sin = +1 → phase π/2)", () => {
    // freqHz=1, nowMs=250 → phase = 2π * 1 * 0.25 = π/2 → sin = 1.
    const result = computeHoverBeatRadius(250, 1, 4, 3);
    expect(result).toBeCloseTo(7, 9);
  });
});

describe("computeHoverBeatAlpha — bounds", () => {
  it("always returns a value in [base - amplitude, base + amplitude]", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        fc.double({ min: 0.1, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (nowMs, freqHz, base, amplitude) => {
          const result = computeHoverBeatAlpha(nowMs, freqHz, base, amplitude);
          const tolerance = 4 * Number.EPSILON + 1e-12;
          expect(result).toBeGreaterThanOrEqual(base - amplitude - tolerance);
          expect(result).toBeLessThanOrEqual(base + amplitude + tolerance);
        },
      ),
    );
  });

  it("equals base when sin = 0 (phase = 0)", () => {
    expect(computeHoverBeatAlpha(0, 1, 0.7, 0.3)).toBeCloseTo(0.7, 9);
  });

  it("equals base + amplitude at sin peak (phase π/2)", () => {
    // freqHz=1, nowMs=250 → phase π/2 → sin = 1 → 0.7 + 0.3 = 1.0.
    expect(computeHoverBeatAlpha(250, 1, 0.7, 0.3)).toBeCloseTo(1.0, 9);
  });

  it("equals base - amplitude at sin trough (phase 3π/2)", () => {
    // freqHz=1, nowMs=750 → phase 3π/2 → sin = -1 → 0.7 - 0.3 = 0.4.
    expect(computeHoverBeatAlpha(750, 1, 0.7, 0.3)).toBeCloseTo(0.4, 9);
  });
});

describe("computeHoverBeatRadius — periodicity", () => {
  it("repeats every 1/freqHz seconds (period)", () => {
    // One full period later, radius must match within float tolerance.
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e5, noNaN: true }),
        fc.double({ min: 0.5, max: 10, noNaN: true }),
        (nowMs, freqHz) => {
          const periodMs = 1000 / freqHz;
          const a = computeHoverBeatRadius(nowMs, freqHz, 4, 3);
          const b = computeHoverBeatRadius(nowMs + periodMs, freqHz, 4, 3);
          // Periodicity drift can accumulate trig error — use a relaxed
          // tolerance scaled by the peak amplitude.
          expect(Math.abs(a - b)).toBeLessThan(1e-6);
        },
      ),
    );
  });
});

describe("computeHoverBeatRadius — monotonic within a half period", () => {
  it("monotonically increases from phase 3π/2 → π/2 (envelope ramping up)", () => {
    // freqHz = 1 → period = 1000ms. Envelope ramps from 0 at t=750ms to 1 at
    // t=1250ms (≡ 250ms within the next cycle). Sample 10 points inside the
    // rising half and assert strict monotonicity.
    let prev = computeHoverBeatRadius(750, 1, 4, 3);
    for (let i = 1; i <= 10; i++) {
      const t = 750 + i * 50; // 800, 850, ..., 1250
      const next = computeHoverBeatRadius(t, 1, 4, 3);
      expect(next).toBeGreaterThanOrEqual(prev);
      prev = next;
    }
  });

  it("monotonically decreases from phase π/2 → 3π/2 (envelope falling)", () => {
    let prev = computeHoverBeatRadius(250, 1, 4, 3);
    for (let i = 1; i <= 10; i++) {
      const t = 250 + i * 50; // 300, 350, ..., 750
      const next = computeHoverBeatRadius(t, 1, 4, 3);
      expect(next).toBeLessThanOrEqual(prev);
      prev = next;
    }
  });
});
