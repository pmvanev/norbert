/// Dashboard computation: pure function mapping SessionMetrics to DashboardData.
///
/// No side effects, no IO imports. Produces formatted metric card data
/// and onboarding state from raw session metrics.

import type { SessionMetrics, MetricCardData, Urgency } from "./types";

// Re-export DailyCostEntry for consumer convenience
export type { DailyCostEntry } from "./types";

// ---------------------------------------------------------------------------
// DashboardData -- the complete dashboard view model
// ---------------------------------------------------------------------------

export interface DashboardData {
  readonly runningCost: MetricCardData;
  readonly tokenCount: MetricCardData;
  readonly activeAgents: MetricCardData;
  readonly toolCalls: MetricCardData;
  readonly contextWindow: MetricCardData;
  readonly dataHealth: MetricCardData;
  readonly isOnboarding: boolean;
  readonly sessionLabel: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure)
// ---------------------------------------------------------------------------

/** Format a number as dollars with two decimal places. */
const formatCost = (cost: number): string => `$${cost.toFixed(2)}`;

/** Format a number with comma separators (e.g. 112400 -> "112,400"). */
const formatWithCommas = (n: number): string => n.toLocaleString("en-US");

/** Format tokens as "Xk" (rounded to nearest thousand). */
const formatTokensK = (tokens: number): string => `${Math.round(tokens / 1000)}k`;

/** Build token breakdown subtitle: "62k in / 50k out". */
const formatTokenSubtitle = (inputTokens: number, outputTokens: number): string =>
  `${formatTokensK(inputTokens)} in / ${formatTokensK(outputTokens)} out`;

// ---------------------------------------------------------------------------
// Urgency computation (pure)
// ---------------------------------------------------------------------------

/** Determine context window urgency from utilization percentage. */
const contextWindowUrgency = (pct: number): Urgency => {
  if (pct >= 90) return "red";
  if (pct >= 70) return "amber";
  return "normal";
};

// ---------------------------------------------------------------------------
// Onboarding detection (pure)
// ---------------------------------------------------------------------------

/** Derive a display label from the session ID. */
export const deriveSessionLabel = (sessionId: string): string => {
  if (sessionId === "" || sessionId === "default") return "";
  return sessionId.length > 20 ? sessionId.slice(0, 17) + "..." : sessionId;
};

/** A session is onboarding when all activity metrics are zero. */
const isOnboardingSession = (metrics: SessionMetrics): boolean =>
  metrics.totalTokens === 0 &&
  metrics.sessionCost === 0 &&
  metrics.toolCallCount === 0 &&
  metrics.activeAgentCount === 0 &&
  metrics.totalEventCount === 0;

// ---------------------------------------------------------------------------
// Card builders (pure)
// ---------------------------------------------------------------------------

const buildRunningCostCard = (metrics: SessionMetrics): MetricCardData => ({
  label: "Running Cost",
  value: formatCost(metrics.sessionCost),
  subtitle: "",
  urgency: "normal",
});

const buildTokenCountCard = (metrics: SessionMetrics): MetricCardData => ({
  label: "Token Count",
  value: formatWithCommas(metrics.totalTokens),
  subtitle: metrics.totalTokens > 0
    ? formatTokenSubtitle(metrics.inputTokens, metrics.outputTokens)
    : "",
  urgency: "normal",
});

const buildActiveAgentsCard = (metrics: SessionMetrics): MetricCardData => ({
  label: "Active Agents",
  value: String(metrics.activeAgentCount),
  subtitle: "",
  urgency: "normal",
});

const buildToolCallsCard = (metrics: SessionMetrics): MetricCardData => ({
  label: "Tool Calls",
  value: String(metrics.toolCallCount),
  subtitle: "",
  urgency: "normal",
});

const buildContextWindowCard = (metrics: SessionMetrics): MetricCardData => ({
  label: "Context Window",
  value: `${metrics.contextWindowPct}%`,
  subtitle: "",
  urgency: contextWindowUrgency(metrics.contextWindowPct),
});

const buildDataHealthCard = (metrics: SessionMetrics): MetricCardData => ({
  label: "Data Health",
  value: metrics.totalEventCount > 0 ? "OK" : "No Events",
  subtitle: metrics.totalEventCount > 0 ? `${metrics.totalEventCount} events` : "",
  urgency: metrics.totalEventCount > 0 ? "normal" : "amber",
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the full dashboard view model from session metrics.
 *
 * Pure function: SessionMetrics => DashboardData.
 * Each metric card is built by a small, focused helper.
 */
export const computeDashboardData = (metrics: SessionMetrics): DashboardData => ({
  runningCost: buildRunningCostCard(metrics),
  tokenCount: buildTokenCountCard(metrics),
  activeAgents: buildActiveAgentsCard(metrics),
  toolCalls: buildToolCallsCard(metrics),
  contextWindow: buildContextWindowCard(metrics),
  dataHealth: buildDataHealthCard(metrics),
  isOnboarding: isOnboardingSession(metrics),
  sessionLabel: deriveSessionLabel(metrics.sessionId),
});

