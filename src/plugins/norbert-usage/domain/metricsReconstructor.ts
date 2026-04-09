/// Metrics Reconstructor: rebuild SessionMetrics from persisted AccumulatedMetric rows.
///
/// AccumulatedMetric[] => SessionMetrics
///
/// Used to populate gauge data for inactive sessions whose in-memory
/// metrics have been cleared. Only token and cost fields can be
/// reconstructed from the database; real-time fields (burn rate,
/// context window, active agents) default to zero.

import type { SessionMetrics } from "./types";
import type { AccumulatedMetric } from "./activeTimeFormatter";
import { createInitialMetrics } from "./metricsAggregator";

/// Extract a token count by matching metric_name "token.usage"
/// and a "type=<tokenType>" segment in the attribute_key.
const sumTokensByType = (
  metrics: ReadonlyArray<AccumulatedMetric>,
  tokenType: string,
): number =>
  metrics
    .filter(
      (m) =>
        m.metricName === "token.usage" &&
        m.attributeKey.split(",").some((seg) => seg === `type=${tokenType}`),
    )
    .reduce((sum, m) => sum + m.value, 0);

/// Sum all cost.usage rows regardless of model.
const sumCost = (metrics: ReadonlyArray<AccumulatedMetric>): number =>
  metrics
    .filter((m) => m.metricName === "cost.usage")
    .reduce((sum, m) => sum + m.value, 0);

/// Reconstruct a SessionMetrics snapshot from persisted database rows.
///
/// Only fields derivable from the stored OTLP metrics are populated;
/// everything else falls back to the defaults from createInitialMetrics.
export const reconstructMetricsFromDb = (
  sessionId: string,
  dbMetrics: ReadonlyArray<AccumulatedMetric>,
): SessionMetrics => {
  const inputTokens = sumTokensByType(dbMetrics, "input");
  const outputTokens = sumTokensByType(dbMetrics, "output");
  const cacheReadTokens = sumTokensByType(dbMetrics, "cache_read");
  const cacheCreationTokens = sumTokensByType(dbMetrics, "cache_creation");
  const totalTokens =
    inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;
  const sessionCost = sumCost(dbMetrics);

  return {
    ...createInitialMetrics(sessionId),
    totalTokens,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    sessionCost,
  };
};
