/// Active Time Formatter: pure function over accumulated metrics.
///
/// Input: array of AccumulatedMetric from backend.
/// Output: ActiveTimeSummary with user/CLI split, percentages, formatted strings.
///
/// No side effects, no IO imports.

// ---------------------------------------------------------------------------
// Shared metric shape (from IPC get_metrics_for_session)
// ---------------------------------------------------------------------------

export interface AccumulatedMetric {
  readonly metricName: string;
  readonly attributeKey: string;
  readonly value: number;
}

// ---------------------------------------------------------------------------
// Output shape
// ---------------------------------------------------------------------------

export interface ActiveTimeSummary {
  readonly userSeconds: number;
  readonly cliSeconds: number;
  readonly totalSeconds: number;
  readonly userPercent: number;
  readonly cliPercent: number;
  readonly userFormatted: string;
  readonly cliFormatted: string;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export const EMPTY_ACTIVE_TIME: ActiveTimeSummary = {
  userSeconds: 0,
  cliSeconds: 0,
  totalSeconds: 0,
  userPercent: 0,
  cliPercent: 0,
  userFormatted: "0s",
  cliFormatted: "0s",
};

// ---------------------------------------------------------------------------
// Duration formatting (pure)
// ---------------------------------------------------------------------------

export const formatDuration = (totalSeconds: number): string => {
  if (totalSeconds <= 0) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

// ---------------------------------------------------------------------------
// Metric extraction helpers (pure)
// ---------------------------------------------------------------------------

const findMetricValue = (
  metrics: ReadonlyArray<AccumulatedMetric>,
  metricName: string,
  attributeKeyContains: string,
): number => {
  const match = metrics.find(
    (m) => m.metricName === metricName && m.attributeKey.includes(attributeKeyContains),
  );
  return match?.value ?? 0;
};

// ---------------------------------------------------------------------------
// Percentage calculation (pure)
// ---------------------------------------------------------------------------

const calculatePercent = (part: number, total: number): number =>
  total > 0 ? Math.round((part / total) * 10000) / 100 : 0;

// ---------------------------------------------------------------------------
// Formatter (pure function)
// ---------------------------------------------------------------------------

export const formatActiveTime = (
  metrics: ReadonlyArray<AccumulatedMetric>,
): ActiveTimeSummary => {
  const userSeconds = findMetricValue(metrics, "active_time.total", "type=user");
  const cliSeconds = findMetricValue(metrics, "active_time.total", "type=cli");
  const totalSeconds = userSeconds + cliSeconds;

  if (totalSeconds === 0 && !metrics.some((m) => m.metricName === "active_time.total")) {
    return EMPTY_ACTIVE_TIME;
  }

  return {
    userSeconds,
    cliSeconds,
    totalSeconds,
    userPercent: calculatePercent(userSeconds, totalSeconds),
    cliPercent: calculatePercent(cliSeconds, totalSeconds),
    userFormatted: formatDuration(userSeconds),
    cliFormatted: formatDuration(cliSeconds),
  };
};
