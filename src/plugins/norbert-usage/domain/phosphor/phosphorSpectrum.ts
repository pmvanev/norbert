/**
 * phosphorSpectrum — deterministic per-theme color spectrum for session traces.
 *
 * Replaces the old fixed 5-slot palette with a generator that produces an
 * arbitrary number of visually-distinct colors inside a theme-declared
 * (hue, saturation, lightness) window. Each session's color is its
 * registration index stepped through the window using the golden-ratio
 * conjugate — a low-discrepancy sequence that gives good visual separation
 * for any N without clustering or obvious repetition.
 *
 * Why golden-ratio stepping?
 *   A naive linear sweep (i / N) through a hue range would put adjacent
 *   sessions next to each other in hue space, which for N=3 sessions
 *   crammed into a 60° window would produce three near-identical colors.
 *   The golden-ratio step `φ ≈ 0.618` applied to the normalized position
 *   produces a pseudo-random yet uniformly-distributed permutation of the
 *   range, so session 0 and session 1 are visually far apart even when the
 *   theme's hue window is narrow.
 *
 * Saturation and lightness get their own sub-steps (φ², φ³) so two sessions
 * that happen to land on similar hues are further disambiguated by value
 * and chroma. A small constant offset on the S/L seeds prevents the i=0
 * session from landing at the (min, min) corner — it picks up a central-
 * ish S/L so it reads like a "default" accent color.
 *
 * Pure module: no React, no DOM, no window/document. View layer is
 * responsible for resolving the spectrum from CSS custom properties and
 * threading it to `buildFrame` via the existing `sessionColors` option.
 */

/** Golden-ratio conjugate — the low-discrepancy step for hue position. */
const PHI = 0.6180339887498949;
/** φ² mod 1 — slower low-discrepancy step for saturation. */
const PHI_SQUARED = 0.3819660112501051;
/** φ³ mod 1 — slowest step for lightness so adjacent indices aren't too dim or too light. */
const PHI_CUBED = 0.2360679774997897;

/** Small offsets so index 0 lands at a central S / L rather than the corner. */
const SAT_OFFSET = 0.15;
const LIGHT_OFFSET = 0.35;

/**
 * A theme's phosphor color window. All fields are absolute HSL components:
 *   - Hue is in degrees, 0..360 (may wrap through 0 — see `hueStart` > `hueEnd`
 *     note below).
 *   - Saturation and lightness are in percent, 0..100.
 *
 * `hueStart` and `hueEnd` delimit the hue window inclusively. If
 * `hueEnd < hueStart`, the window is interpreted as wrapping through 360° —
 * e.g. start=340, end=20 gives a 40° window centered on red. The common
 * case (start < end) is treated as a simple linear range.
 */
export interface PhosphorSpectrum {
  readonly hueStart: number;
  readonly hueEnd: number;
  readonly satStart: number;
  readonly satEnd: number;
  readonly lightStart: number;
  readonly lightEnd: number;
}

/** Interpolate `t ∈ [0,1]` across `[a, b]`, supporting wrap when b < a (hue only). */
const lerpWrapping = (a: number, b: number, t: number, wrap: number): number => {
  if (b >= a) return a + t * (b - a);
  const span = b + wrap - a;
  return (a + t * span) % wrap;
};

/**
 * Compute the i-th color in the spectrum as a CSS `hsl(...)` string. Pure
 * and referentially transparent: the same (index, spectrum) always produces
 * the same output regardless of how many other colors are generated around
 * it. Legitimate for use on the canvas rendering path and in DOM styles.
 */
export const colorForSpectrumIndex = (
  index: number,
  spectrum: PhosphorSpectrum,
): string => {
  const huePos = (index * PHI) % 1;
  const satPos = (index * PHI_SQUARED + SAT_OFFSET) % 1;
  const lightPos = (index * PHI_CUBED + LIGHT_OFFSET) % 1;
  const hue = lerpWrapping(spectrum.hueStart, spectrum.hueEnd, huePos, 360);
  const sat = spectrum.satStart + satPos * (spectrum.satEnd - spectrum.satStart);
  const light = spectrum.lightStart + lightPos * (spectrum.lightEnd - spectrum.lightStart);
  return `hsl(${hue.toFixed(1)}, ${sat.toFixed(1)}%, ${light.toFixed(1)}%)`;
};

/**
 * Generate `count` colors from the spectrum, one per registration index.
 * Count ≥ 0; returns an empty array when count is zero so callers can fall
 * back to the default `SESSION_COLORS` palette.
 */
export const generatePhosphorPalette = (
  spectrum: PhosphorSpectrum,
  count: number,
): ReadonlyArray<string> => {
  if (count <= 0) return [];
  const palette = new Array<string>(count);
  for (let i = 0; i < count; i++) {
    palette[i] = colorForSpectrumIndex(i, spectrum);
  }
  return palette;
};
