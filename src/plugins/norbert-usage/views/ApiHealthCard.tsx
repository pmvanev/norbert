/// ApiHealthCard: thin view wrapper for API health aggregation.
///
/// Calls pure domain aggregator and renders the result.
/// No business logic in this component.

import { aggregateApiHealth, type ApiErrorEvent, type ApiHealthSummary } from "../domain/apiHealthAggregator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ApiHealthCardProps {
  readonly events: ReadonlyArray<ApiErrorEvent>;
  readonly totalApiRequests: number;
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure, view-level)
// ---------------------------------------------------------------------------

const formatPercentage = (rate: number): string =>
  `${(rate * 100).toFixed(1)}%`;

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = (): JSX.Element => (
  <div className="card-empty-state">
    <span className="card-empty-icon">{"\u2714"}</span>
    <span className="card-empty-label">No API errors recorded</span>
  </div>
);

// ---------------------------------------------------------------------------
// Status code row
// ---------------------------------------------------------------------------

const StatusCodeRow = ({
  code,
  count,
}: {
  readonly code: number;
  readonly count: number;
}): JSX.Element => (
  <div className="status-code-row">
    <span className="status-code">{code === 0 ? "Unknown" : code}</span>
    <span className="status-count">{count}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Summary header
// ---------------------------------------------------------------------------

const SummaryHeader = ({ summary }: { readonly summary: ApiHealthSummary }): JSX.Element => (
  <div className="card-summary">
    <span>Error Rate: {formatPercentage(summary.errorRate)}</span>
    <span>{summary.totalErrors} error{summary.totalErrors !== 1 ? "s" : ""} / {summary.totalApiRequests} API calls</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ApiHealthCard = ({ events, totalApiRequests }: ApiHealthCardProps): JSX.Element => {
  const summary = aggregateApiHealth(events, totalApiRequests);

  return (
    <div className="dashboard-card api-health-card">
      <div className="sec-hdr">
        <h3>API Health</h3>
      </div>
      {summary.totalErrors === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryHeader summary={summary} />
          <div className="status-code-breakdown">
            {Array.from(summary.byStatusCode.entries())
              .sort(([a], [b]) => a - b)
              .map(([code, count]) => (
                <StatusCodeRow key={code} code={code} count={count} />
              ))}
          </div>
        </>
      )}
    </div>
  );
};
