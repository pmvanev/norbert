/**
 * Rate-derivation helpers — count-and-window to RateSample conversions.
 *
 * The phosphor scope ingests upstream activity (hook events, OTel log arrivals,
 * tool-call events) and must project it as per-second rate samples at the
 * RATE_TICK_MS cadence. Each helper in this module is a pure function of a
 * count, a window length, and a tick-boundary timestamp. They do not mutate
 * any store — the caller appends the returned sample.
 *
 * Semantics (v2-phosphor-architecture §5 Q1):
 *   deriveEventsRate(count, windowMs, tickBoundaryT)
 *     = { t: tickBoundaryT, v: count / (windowMs / 1000) }
 *
 * Step 08-01 delivers `deriveEventsRate`. Companion helpers
 * `deriveTokensRate` (IC-S2) and `deriveToolCallsRate` (IC-S3) land in
 * subsequent steps; they share this module to keep the derivation surface
 * discoverable in a single pure file under `domain/phosphor/`.
 *
 * Pure: no effects, no imports outside `phosphorMetricConfig` (seam types).
 * Composes trivially at the hookProcessor effect boundary.
 */

import type { RateSample } from "./phosphorMetricConfig";

// ---------------------------------------------------------------------------
// Internal helpers — small, well-named, reusable across rate helpers
// ---------------------------------------------------------------------------

/** Convert a window length in milliseconds to its equivalent in seconds. */
const windowSeconds = (windowMs: number): number => windowMs / 1000;

/** Compute a per-second rate from a count across a window. */
const perSecond = (count: number, windowMs: number): number =>
  count / windowSeconds(windowMs);

// ---------------------------------------------------------------------------
// Public API — one function per rate helper
// ---------------------------------------------------------------------------

/**
 * Derive an events-per-second `RateSample` from a windowed event count.
 *
 * `count` is the number of hook events (and OTel log arrivals, when the
 * upstream stream blends them) observed across the preceding `windowMs`
 * interval. `tickBoundaryT` is the tick-boundary timestamp assigned to the
 * returned sample; the store appends it as-is.
 *
 * Pure: total over finite non-negative inputs. No validation — callers upstream
 * are responsible for passing `windowMs > 0` and `count >= 0`. The function is
 * intentionally permissive so it composes cleanly inside pipelines.
 */
export const deriveEventsRate = (
  count: number,
  windowMs: number,
  tickBoundaryT: number,
): RateSample => ({
  t: tickBoundaryT,
  v: perSecond(count, windowMs),
});
