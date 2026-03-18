/// Shared urgency threshold constants for the performance monitor.
///
/// Single source of truth consumed by gaugeCluster, crossSessionAggregator,
/// and future PM modules. No side effects, no IO imports.

import type { Urgency } from "./types";

// ---------------------------------------------------------------------------
// UrgencyThresholds -- shared threshold configuration
// ---------------------------------------------------------------------------

export interface UrgencyThresholds {
  readonly contextAmber: number;
  readonly contextRed: number;
  readonly tokenRateAmber: number;
  readonly tokenRateRed: number;
}

/** Default urgency thresholds for the performance monitor. */
export const DEFAULT_URGENCY_THRESHOLDS: UrgencyThresholds = {
  contextAmber: 70,
  contextRed: 90,
  tokenRateAmber: 400,
  tokenRateRed: 500,
};

// ---------------------------------------------------------------------------
// Named threshold constants for cross-module reference
// ---------------------------------------------------------------------------

/** Amber threshold for context window percentage (shared with Gauge Cluster). */
export const CONTEXT_AMBER_THRESHOLD =
  DEFAULT_URGENCY_THRESHOLDS.contextAmber;

/** Red threshold for context window percentage (shared with Gauge Cluster). */
export const CONTEXT_RED_THRESHOLD =
  DEFAULT_URGENCY_THRESHOLDS.contextRed;

// ---------------------------------------------------------------------------
// Urgency classifiers -- small pure functions
// ---------------------------------------------------------------------------

/** Classify context window percentage into an urgency level. */
export const classifyContextUrgency = (
  contextWindowPct: number,
  thresholds: UrgencyThresholds = DEFAULT_URGENCY_THRESHOLDS,
): Urgency => {
  if (contextWindowPct >= thresholds.contextRed) return "red";
  if (contextWindowPct >= thresholds.contextAmber) return "amber";
  return "normal";
};

/** Classify token burn rate into an urgency level. */
export const classifyTokenRateUrgency = (
  tokenRate: number,
  thresholds: UrgencyThresholds = DEFAULT_URGENCY_THRESHOLDS,
): Urgency => {
  if (tokenRate >= thresholds.tokenRateRed) return "red";
  if (tokenRate >= thresholds.tokenRateAmber) return "amber";
  return "normal";
};
