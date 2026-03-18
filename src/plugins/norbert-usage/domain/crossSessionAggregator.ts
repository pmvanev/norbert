/// Cross-session aggregator: pure function over active session metrics.
///
/// aggregateAcrossSessions(sessions) => AggregateMetrics
///
/// No side effects, no IO imports. Computes totals by folding over
/// the sessions array and produces a sorted breakdown.

import type {
  SessionMetrics,
  AggregateMetrics,
  SessionSummary,
} from "./types";
import { estimateSessionCostRate } from "./performanceMonitor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a SessionMetrics snapshot into a SessionSummary for the breakdown. */
const toSessionSummary = (session: SessionMetrics): SessionSummary => ({
  sessionId: session.sessionId,
  tokenRate: session.burnRate,
  costRate: estimateSessionCostRate(session),
  contextWindowPct: session.contextWindowPct,
  activeAgentCount: session.activeAgentCount,
  sessionCost: session.sessionCost,
});

/** Sort session summaries by token rate descending. */
const sortByTokenRateDescending = (
  summaries: ReadonlyArray<SessionSummary>,
): ReadonlyArray<SessionSummary> =>
  [...summaries].sort((a, b) => b.tokenRate - a.tokenRate);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Empty aggregate constant -- identity element for aggregation. */
const EMPTY_AGGREGATE: AggregateMetrics = {
  totalTokenRate: 0,
  totalCostRate: 0,
  totalActiveAgents: 0,
  sessionCount: 0,
  sessions: [],
};

/**
 * Aggregate metrics across all active sessions.
 *
 * Pure function: ReadonlyArray<SessionMetrics> => AggregateMetrics
 *
 * Totals are computed as sums of per-session values.
 * The sessions breakdown is sorted by token rate descending.
 */
export const aggregateAcrossSessions = (
  sessions: ReadonlyArray<SessionMetrics>,
): AggregateMetrics => {
  if (sessions.length === 0) return EMPTY_AGGREGATE;

  const totalTokenRate = sessions.reduce((sum, s) => sum + s.burnRate, 0);
  const totalCostRate = sessions.reduce((sum, s) => sum + estimateSessionCostRate(s), 0);
  const totalActiveAgents = sessions.reduce((sum, s) => sum + s.activeAgentCount, 0);
  const summaries = sortByTokenRateDescending(sessions.map(toSessionSummary));

  return {
    totalTokenRate,
    totalCostRate,
    totalActiveAgents,
    sessionCount: sessions.length,
    sessions: summaries,
  };
};

export type { AggregateMetrics, SessionSummary };
