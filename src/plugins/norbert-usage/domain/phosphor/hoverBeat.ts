/**
 * Hover-beat pulse math — pure radius/alpha modulation for the beating dot
 * rendered at the currently-hovered sample on the phosphor scope.
 *
 * The beat is a sinusoidal modulation of radius and opacity. Radius uses a
 * half-rectified sine envelope (always non-negative so the dot never shrinks
 * below `base`); alpha uses the raw sine so opacity swings symmetrically
 * around a mid-point for a breathing "pulse" feel.
 *
 *   radius(t) = base + amplitude * (0.5 + 0.5 * sin(2π * freqHz * t))
 *     → bounded in [base, base + amplitude]
 *
 *   alpha(t)  = base + amplitude * sin(2π * freqHz * t)
 *     → bounded in [base - amplitude, base + amplitude]
 *
 * Frequency note (display):
 *   At a 60fps render cadence, a frequency close to 60 Hz aliases into a
 *   near-static dot (sampling exactly the same phase each frame). ~2 Hz
 *   (120 bpm) gives a clearly-visible pulse well below Nyquist and stays
 *   free of aliasing under varying render rates. Caller picks the
 *   constant; these helpers are oblivious to render cadence.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, `document`,
 * or `domain/oscilloscope`. No effects. Deterministic in inputs.
 */

/** Angular position (radians) at time `nowMs` for a sinusoid at `freqHz`. */
const phase = (nowMs: number, freqHz: number): number =>
  2 * Math.PI * freqHz * (nowMs / 1000);

/**
 * Half-rectified sine envelope in [0, 1] — the radius modulator. Equals 0
 * at the sine trough, 1 at the sine peak.
 */
const envelope01 = (nowMs: number, freqHz: number): number =>
  0.5 + 0.5 * Math.sin(phase(nowMs, freqHz));

/**
 * Radius at time `nowMs`, modulated between `base` and `base + amplitude`.
 * The `+ amplitude * envelope01` term ensures the dot never shrinks below
 * `base` — a consumer concerned with minimum visible size picks `base`,
 * a consumer concerned with visible pulse picks `amplitude`.
 */
export const computeHoverBeatRadius = (
  nowMs: number,
  freqHz: number,
  base: number,
  amplitude: number,
): number => base + amplitude * envelope01(nowMs, freqHz);

/**
 * Alpha at time `nowMs`, modulated symmetrically around `base` with
 * half-width `amplitude`. The result sits in `[base - amplitude, base + amplitude]`.
 * Callers should pick `base`/`amplitude` so the interval stays within
 * the canvas's usable alpha range (typically [0, 1]).
 */
export const computeHoverBeatAlpha = (
  nowMs: number,
  freqHz: number,
  base: number,
  amplitude: number,
): number => base + amplitude * Math.sin(phase(nowMs, freqHz));
