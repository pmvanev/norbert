/// Context pressure tracking pure functions for the performance monitor.
///
/// Provides urgency classification and compaction time estimation.
/// Re-exports classifyContextUrgency from urgencyThresholds for
/// convenient single-module access. No side effects, no IO imports.

import type { SessionMetrics, CompactionEstimate, PMViewMode, AgentMetrics, SessionDetailData } from "./types";

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
 * Convert a cost rate from dollars-per-second to dollars-per-minute.
 *
 * Pure scalar conversion: rate * 60.
 */
export const computeCostRatePerMinute = (costRatePerSecond: number): number =>
  costRatePerSecond * SECONDS_PER_MINUTE;

/**
 * Format a cost rate (dollars-per-second) as a human-readable per-minute string.
 *
 * Shows four decimal places for very small rates (< $0.01/min),
 * two decimal places otherwise, and "$0.00/min" for zero.
 */
export const formatCostPerMinute = (costRatePerSecond: number): string => {
  const perMin = computeCostRatePerMinute(costRatePerSecond);
  if (perMin === 0) return "$0.00/min";
  if (perMin < 0.01) return `$${perMin.toFixed(4)}/min`;
  return `$${perMin.toFixed(2)}/min`;
};

// ---------------------------------------------------------------------------
// Per-session cost rate estimation
// ---------------------------------------------------------------------------

/**
 * Estimate the instantaneous cost rate for a session.
 *
 * Uses average cost per token (sessionCost / totalTokens) multiplied by
 * current burn rate (tokens/second) to estimate current dollars per second.
 *
 * When totalTokens is zero but sessionCost is positive, falls back to
 * sessionCost as a rate estimate (treating it as if one second has elapsed).
 * When burnRate is zero the session is idle and cost rate is zero.
 */
export const estimateSessionCostRate = (session: SessionMetrics): number => {
  if (session.burnRate <= 0) return 0;
  if (session.totalTokens > 0) {
    return (session.sessionCost / session.totalTokens) * session.burnRate;
  }
  // Fallback: sessionCost > 0 but no token count yet
  return session.sessionCost > 0 ? session.sessionCost : 0;
};

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

// ---------------------------------------------------------------------------
// Navigation state machine -- pure functions
// ---------------------------------------------------------------------------

/** Base breadcrumb label for the Performance Monitor view. */
const PM_VIEW_LABEL = "Performance Monitor";

/** Create the default aggregate view mode. */
export const createAggregateViewMode = (): PMViewMode => ({
  tag: "aggregate",
});

/** Create a session detail view mode for the given session identifier. */
export const createSessionDetailViewMode = (sessionId: string): PMViewMode => ({
  tag: "session-detail",
  sessionId,
});

/**
 * Compute the breadcrumb string for the current navigation state.
 *
 * Aggregate mode: "Performance Monitor"
 * Session detail: "Performance Monitor > {sessionId}"
 */
export const computeBreadcrumb = (viewMode: PMViewMode): string => {
  switch (viewMode.tag) {
    case "aggregate":
      return PM_VIEW_LABEL;
    case "session-detail":
      return `${PM_VIEW_LABEL} > ${viewMode.sessionId}`;
  }
};

// ---------------------------------------------------------------------------
// Session detail data composition -- pure function
// ---------------------------------------------------------------------------

/**
 * Compose session detail data from metrics and optional agent breakdown.
 *
 * When agents are not provided, defaults to an empty array (graceful
 * degradation). Compaction estimate is derived from session metrics.
 */
export const computeSessionDetailData = (
  metrics: SessionMetrics,
  agents: ReadonlyArray<AgentMetrics> = [],
): SessionDetailData => ({
  sessionId: metrics.sessionId,
  metrics,
  agents,
  compaction: computeCompactionEstimate(metrics),
});
