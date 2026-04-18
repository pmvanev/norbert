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
 *   deriveToolCallsRate(toolCallCount, windowMs, tickBoundaryT)
 *     = { t: tickBoundaryT, v: toolCallCount / (windowMs / 1000) }
 *
 * Steps 08-01 / 08-02 / 08-03 deliver the derivation surface in sequence:
 * `deriveEventsRate`, `deriveTokensRate`, and `deriveToolCallsRate` share
 * this module so the full set stays discoverable in a single pure file
 * under `domain/phosphor/`.
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

/**
 * Derive a tokens-per-second `RateSample` from an OTel api-request event.
 *
 * `totalTokens` is the total token count reported by the api-request event
 * (input + output + cache tokens as aggregated upstream). `durationMs` is the
 * wall-clock duration the request took. `tickBoundaryT` is the timestamp the
 * store will append on the returned sample.
 *
 * Semantics (v2-phosphor-architecture §5 Q1):
 *   deriveTokensRate(totalTokens, durationMs, t)
 *     = { t, v: totalTokens / (durationMs / 1000) }
 *
 * Zero-duration defensive lock: a `durationMs <= 0` yields `v = 0` rather
 * than producing `Infinity` or `NaN`. OTel api-request events occasionally
 * arrive with a zero or negative duration (clock skew, partial records); the
 * scope pipeline should emit a silent zero sample rather than crash. Pure:
 * total over all finite inputs.
 */
export const deriveTokensRate = (
  totalTokens: number,
  durationMs: number,
  tickBoundaryT: number,
): RateSample => ({
  t: tickBoundaryT,
  v: durationMs > 0 ? perSecond(totalTokens, durationMs) : 0,
});

/**
 * Derive a tool-calls-per-second `RateSample` from a windowed tool-call count.
 *
 * `toolCallCount` is the number of tool-call events observed for a session
 * across the preceding `windowMs` interval. `tickBoundaryT` is the
 * tick-boundary timestamp assigned to the returned sample; the store
 * appends it as-is.
 *
 * Semantics (v2-phosphor-architecture §5 Q1):
 *   deriveToolCallsRate(toolCallCount, windowMs, t)
 *     = { t, v: toolCallCount / (windowMs / 1000) }
 *
 * Pure: total over finite non-negative inputs. Shape mirrors
 * `deriveEventsRate` — both are windowed counters. Kept as a distinct named
 * function so the derivation seam names match the `MetricId` domain
 * vocabulary (`events` vs `toolcalls`) at the hookProcessor boundary.
 */
export const deriveToolCallsRate = (
  toolCallCount: number,
  windowMs: number,
  tickBoundaryT: number,
): RateSample => ({
  t: tickBoundaryT,
  v: perSecond(toolCallCount, windowMs),
});
