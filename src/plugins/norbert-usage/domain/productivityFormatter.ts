/// Productivity Formatter: pure function over accumulated metrics.
///
/// Input: array of AccumulatedMetric from backend.
/// Output: ProductivitySummary with lines added/removed, commits, PRs.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// Shared metric shape (re-exported for test convenience)
// ---------------------------------------------------------------------------

export type { AccumulatedMetric } from "./activeTimeFormatter";
import type { AccumulatedMetric } from "./activeTimeFormatter";

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface ProductivitySummary {
  readonly linesAdded: number;
  readonly linesRemoved: number;
  readonly netLines: number;
  readonly commits: number;
  readonly pullRequests: number;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_PRODUCTIVITY: ProductivitySummary = {
  linesAdded: 0,
  linesRemoved: 0,
  netLines: 0,
  commits: 0,
  pullRequests: 0,
};

// ---------------------------------------------------------------------------
// Metric extraction helper (pure)
// ---------------------------------------------------------------------------

const findMetricValue = (
  metrics: ReadonlyArray<AccumulatedMetric>,
  metricName: string,
  attributeKeyContains: string = "",
): number => {
  const match = metrics.find(
    (m) =>
      m.metricName === metricName &&
      (attributeKeyContains === "" ? true : m.attributeKey.includes(attributeKeyContains)),
  );
  return match?.value ?? 0;
};

// ---------------------------------------------------------------------------
// Known productivity metric names
// ---------------------------------------------------------------------------

const PRODUCTIVITY_METRICS = ["lines_of_code.count", "commit.count", "pull_request.count"];

// ---------------------------------------------------------------------------
// Formatter (pure function)
// ---------------------------------------------------------------------------

export const formatProductivity = (
  metrics: ReadonlyArray<AccumulatedMetric>,
): ProductivitySummary => {
  const hasProductivityMetrics = metrics.some((m) =>
    PRODUCTIVITY_METRICS.includes(m.metricName),
  );

  if (!hasProductivityMetrics) {
    return EMPTY_PRODUCTIVITY;
  }

  const linesAdded = findMetricValue(metrics, "lines_of_code.count", "type=added");
  const linesRemoved = findMetricValue(metrics, "lines_of_code.count", "type=removed");
  const commits = findMetricValue(metrics, "commit.count");
  const pullRequests = findMetricValue(metrics, "pull_request.count");

  return {
    linesAdded,
    linesRemoved,
    netLines: linesAdded - linesRemoved,
    commits,
    pullRequests,
  };
};
