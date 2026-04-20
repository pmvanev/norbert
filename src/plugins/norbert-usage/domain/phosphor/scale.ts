/**
 * Phosphor scale helpers — pure numeric utilities for axis scaling.
 *
 * `niceCeil` is the building block for dynamic Y-axis auto-scaling. It maps
 * an arbitrary positive peak value to the next "nice" round number — a value
 * of the form `mantissa * 10^k` where `mantissa` is drawn from the set
 * `{1, 1.5, 2, 3, 5, 7, 10}`. This matches Phil's expectation that the
 * Y-axis ceiling snaps to a readable grid (1.5, 2, 3, 5, 7, 10, 15, 20, 30,
 * 50, 70, 100, ...) rather than an arbitrary float like 12.3. The expanded
 * mantissa set (vs. the classic `{1, 2, 5, 10}`) keeps labels monospace-
 * readable while roughly halving the worst-case wasted vertical space on
 * the phosphor scope — a peak of 2.5 resolves to 3 instead of 5.
 *
 * Properties (covered by the property-based test suite):
 *   - Output is always >= input (it's a ceiling, not a round).
 *   - Output is always a "nice" number: `output = m * 10^k` where
 *     `m in {1, 1.5, 2, 3, 5, 7, 10}` and `k >= some integer`.
 *   - Monotonic: `a <= b` implies `niceCeil(a) <= niceCeil(b)`.
 *   - Idempotent on nice inputs: `niceCeil(niceCeil(x)) === niceCeil(x)`.
 *
 * Boundary: non-positive inputs are clamped to the smallest nice number (1).
 * Non-finite inputs (NaN, Infinity) are not valid domain inputs; the function
 * returns 1 as a safe floor so callers cannot propagate garbage into the
 * render pipeline.
 *
 * Pure: no IO, no imports from adapters/views/window/document.
 */

// The ordered list of nice mantissas. The final entry `10` is conceptually
// redundant with the start of the next power-of-ten band (1 * 10^(k+1)), but
// keeping it simplifies the lookup: any value `x` in `(1 * 10^k, 10 * 10^k]`
// resolves to the first entry in this list that matches `x / 10^k`.
//
// The intermediate entries `1.5`, `3`, `7` fill the coarse jumps of the
// classic `{1, 2, 5, 10}` set. Without them a peak of 2.5 rounds up to 5
// (wasting 50% of the axis); with `3` available it rounds to 3 and the
// trace fills the middle-to-upper band of the scope as intended.
const NICE_MANTISSAS: ReadonlyArray<number> = [1, 1.5, 2, 3, 5, 7, 10];

/**
 * Return the next "nice" number >= `value`. A nice number has the form
 * `m * 10^k` where `m` is drawn from `{1, 1.5, 2, 3, 5, 7, 10}`.
 *
 * Examples:
 *   niceCeil(0.3)  -> 1
 *   niceCeil(1)    -> 1
 *   niceCeil(1.1)  -> 1.5
 *   niceCeil(2.5)  -> 3
 *   niceCeil(3)    -> 3
 *   niceCeil(6)    -> 7
 *   niceCeil(11)   -> 15
 *   niceCeil(47)   -> 50
 *   niceCeil(123)  -> 150
 *   niceCeil(501)  -> 700
 *
 * Boundary:
 *   - Non-finite input (NaN, ±Infinity) returns 1.
 *   - Non-positive input (0, negatives) returns 1.
 */
export const niceCeil = (value: number): number => {
  if (!Number.isFinite(value) || value <= 1) return 1;
  // exponent k such that 10^k <= value < 10^(k+1); `log10(value)` is finite
  // and positive here so `floor` is well-defined.
  const exponent = Math.floor(Math.log10(value));
  const power = Math.pow(10, exponent);
  const mantissa = value / power;
  // Find the first nice mantissa >= value's mantissa. Because we chose
  // `exponent` via `floor(log10(value))`, `mantissa` is in `[1, 10)` — except
  // at exact powers of 10 where float rounding may push mantissa to ~1.0 or
  // ~10.0, both of which are handled by the `{1, 1.5, 2, 3, 5, 7, 10}` set.
  for (const m of NICE_MANTISSAS) {
    if (m >= mantissa - Number.EPSILON) return m * power;
  }
  // Unreachable given NICE_MANTISSAS contains 10, but guards against list
  // edits: fall through to the next decade.
  return 10 * power;
};
