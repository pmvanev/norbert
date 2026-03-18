/// Context pressure tracking pure functions for the performance monitor.
///
/// Provides urgency classification and compaction time estimation.
/// Re-exports classifyContextUrgency from urgencyThresholds for
/// convenient single-module access. No side effects, no IO imports.

import type { SessionMetrics } from "./metricsAggregator";
import type { CompactionEstimate } from "./types";

// Re-export classifyContextUrgency so consumers can import from one module
export { classifyContextUrgency } from "./urgencyThresholds";

// ---------------------------------------------------------------------------
// Compaction estimate -- pure function
// ---------------------------------------------------------------------------

/** Minimum burn rate (tokens/second) to consider the estimate reliable. */
const MIN_RELIABLE_BURN_RATE = 1;

/** Seconds per minute constant for conversion. */
const SECONDS_PER_MINUTE = 60;

/**
 * Compute estimated time until context window compaction.
 *
 * Remaining headroom divided by burn rate gives seconds to exhaustion,
 * converted to minutes. When burn rate is near zero the estimate is
 * marked low-confidence since extrapolation is unreliable.
 */
export const computeCompactionEstimate = (
  metrics: SessionMetrics,
): CompactionEstimate => {
  const remainingTokens =
    metrics.contextWindowMaxTokens - metrics.contextWindowTokens;

  const isReliable = metrics.burnRate >= MIN_RELIABLE_BURN_RATE;

  const estimatedMinutes = isReliable
    ? remainingTokens / metrics.burnRate / SECONDS_PER_MINUTE
    : 0;

  return {
    estimatedMinutes,
    confidence: isReliable ? "high" : "low",
    currentPct: metrics.contextWindowPct,
    remainingTokens,
  };
};
