/// ActiveTimeCard: thin view wrapper for active time formatting.
///
/// Calls pure domain formatter and renders the result.
/// No business logic in this component.

import { formatActiveTime, formatDuration, type AccumulatedMetric, type ActiveTimeSummary } from "../domain/activeTimeFormatter";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActiveTimeCardProps {
  readonly metrics: ReadonlyArray<AccumulatedMetric>;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = (): JSX.Element => (
  <div className="card-empty-state">
    <span className="card-empty-icon">{"\u2014"}</span>
    <span className="card-empty-label">No active time data. Verify OTEL_METRICS_EXPORTER=otlp is set.</span>
  </div>
);

// ---------------------------------------------------------------------------
// Time bar row
// ---------------------------------------------------------------------------

const TimeRow = ({
  label,
  formatted,
  percent,
}: {
  readonly label: string;
  readonly formatted: string;
  readonly percent: number;
}): JSX.Element => (
  <div className="time-row">
    <span className="time-label">{label}:</span>
    <span className="time-value">{formatted}</span>
    <span className="time-bar">
      <span className="time-bar-fill" style={{ width: `${percent}%` }} />
    </span>
    <span className="time-percent">{percent.toFixed(0)}%</span>
  </div>
);

// ---------------------------------------------------------------------------
// Summary footer
// ---------------------------------------------------------------------------

const TotalRow = ({ summary }: { readonly summary: ActiveTimeSummary }): JSX.Element => (
  <div className="time-total">
    <span>Total: {formatDuration(summary.totalSeconds)}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ActiveTimeCard = ({ metrics }: ActiveTimeCardProps): JSX.Element => {
  const summary = formatActiveTime(metrics);
  const isEmpty = summary.totalSeconds === 0 && summary.userSeconds === 0 && summary.cliSeconds === 0;

  return (
    <div className="dashboard-card active-time-card">
      <div className="sec-hdr">
        <h3>Active Time</h3>
      </div>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <TimeRow label="User" formatted={summary.userFormatted} percent={summary.userPercent} />
          <TimeRow label="CLI" formatted={summary.cliFormatted} percent={summary.cliPercent} />
          <TotalRow summary={summary} />
        </>
      )}
    </div>
  );
};
