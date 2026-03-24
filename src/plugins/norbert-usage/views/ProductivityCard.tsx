/// ProductivityCard: thin view wrapper for productivity formatting.
///
/// Calls pure domain formatter and renders the result.
/// No business logic in this component.

import { formatProductivity, type AccumulatedMetric, type ProductivitySummary } from "../domain/productivityFormatter";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductivityCardProps {
  readonly metrics: ReadonlyArray<AccumulatedMetric>;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = (): JSX.Element => (
  <div className="card-empty-state">
    <span className="card-empty-icon">{"\u2014"}</span>
    <span className="card-empty-label">No productivity data. Verify OTEL_METRICS_EXPORTER=otlp is set.</span>
  </div>
);

// ---------------------------------------------------------------------------
// Code changes section
// ---------------------------------------------------------------------------

const CodeChanges = ({ summary }: { readonly summary: ProductivitySummary }): JSX.Element => (
  <div className="productivity-section">
    <div className="productivity-row">
      <span className="productivity-label">Lines added:</span>
      <span className="productivity-value productivity-added">+{summary.linesAdded}</span>
    </div>
    <div className="productivity-row">
      <span className="productivity-label">Lines removed:</span>
      <span className="productivity-value productivity-removed">-{summary.linesRemoved}</span>
    </div>
    <div className="productivity-row productivity-net">
      <span className="productivity-label">Net change:</span>
      <span className="productivity-value">
        {summary.netLines >= 0 ? `+${summary.netLines}` : `${summary.netLines}`} lines
      </span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Git activity section
// ---------------------------------------------------------------------------

const GitActivity = ({ summary }: { readonly summary: ProductivitySummary }): JSX.Element => (
  <div className="productivity-section">
    <div className="productivity-row">
      <span className="productivity-label">Commits:</span>
      <span className="productivity-value">{summary.commits}</span>
    </div>
    <div className="productivity-row">
      <span className="productivity-label">Pull Requests:</span>
      <span className="productivity-value">{summary.pullRequests}</span>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ProductivityCard = ({ metrics }: ProductivityCardProps): JSX.Element => {
  const summary = formatProductivity(metrics);
  const isEmpty =
    summary.linesAdded === 0 &&
    summary.linesRemoved === 0 &&
    summary.commits === 0 &&
    summary.pullRequests === 0;

  return (
    <div className="dashboard-card productivity-card">
      <div className="sec-hdr">
        <h3>Productivity</h3>
      </div>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          <CodeChanges summary={summary} />
          <GitActivity summary={summary} />
        </>
      )}
    </div>
  );
};
