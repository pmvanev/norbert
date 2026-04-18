/**
 * Pulse timing — pure helpers for pulse lifetime + store retention.
 *
 * Two responsibilities, each one pure function:
 *
 *   1. `decayFactor(ageMs, lifetimeMs)` — maps a pulse's age to a visual
 *      decay factor in [0, 1]. `1` is fully fresh; `0` is at the lifetime
 *      boundary. The mapping is linear and clamped: negative ages (future
 *      pulse timestamps, which can arise from clock skew) clamp to 1; ages
 *      past the lifetime clamp to 0. This makes the "visible vs invisible"
 *      distinction a direct `decay > 0` check for downstream consumers.
 *
 *   2. `prunePulses(log, now, cutoffMs)` — returns a NEW readonly array of
 *      pulses whose age `(now - p.t)` is ≤ `cutoffMs`. Never mutates the
 *      input log. Used by the store's `getPulses(sessionId, now)` to trim
 *      on read against the retention window.
 *
 * Pure: no imports from `react`, `adapters`, `views`, `window`, or `document`.
 * Depends only on the seam types in `phosphorMetricConfig`.
 */

import type { Pulse } from "./phosphorMetricConfig";

// ---------------------------------------------------------------------------
// decayFactor
// ---------------------------------------------------------------------------

/**
 * Linear decay from 1 (fresh) to 0 (at lifetime boundary), clamped outside
 * `[0, lifetimeMs]`.
 *
 * Examples (lifetime = 2500ms):
 *   - age =   0 → 1.00  (fully fresh)
 *   - age = 1250 → 0.50  (mid-life)
 *   - age = 2500 → 0.00  (boundary)
 *   - age = 3000 → 0.00  (clamped)
 *   - age = -500 → 1.00  (clamped — negative ages treated as fresh)
 */
export const decayFactor = (ageMs: number, lifetimeMs: number): number => {
  if (ageMs <= 0) return 1;
  if (ageMs >= lifetimeMs) return 0;
  return 1 - ageMs / lifetimeMs;
};

// ---------------------------------------------------------------------------
// prunePulses
// ---------------------------------------------------------------------------

/**
 * Return a NEW array containing pulses whose age `(now - p.t)` is ≤
 * `cutoffMs`. The input is never mutated. Idempotent when re-applied with
 * the same `(now, cutoffMs)`.
 *
 * Order is preserved from the input log so callers observing time-ordered
 * inputs continue to observe time-ordered outputs.
 */
export const prunePulses = (
  log: ReadonlyArray<Pulse>,
  now: number,
  cutoffMs: number,
): ReadonlyArray<Pulse> => log.filter((pulse) => now - pulse.t <= cutoffMs);
