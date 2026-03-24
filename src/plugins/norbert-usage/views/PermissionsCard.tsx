/// PermissionsCard: thin view wrapper for permissions aggregation.
///
/// Calls pure domain aggregator and renders the result.
/// No business logic in this component.

import { aggregatePermissions, type ToolDecisionEvent } from "../domain/permissionsAggregator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PermissionsCardProps {
  readonly events: ReadonlyArray<ToolDecisionEvent>;
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure, view-level)
// ---------------------------------------------------------------------------

const formatPercentage = (rate: number): string =>
  `${(rate * 100).toFixed(0)}%`;

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = (): JSX.Element => (
  <div className="card-empty-state">
    <span className="card-empty-icon">{"\u2014"}</span>
    <span className="card-empty-label">No permission decisions recorded</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PermissionsCard = ({ events }: PermissionsCardProps): JSX.Element => {
  const summary = aggregatePermissions(events);

  return (
    <div className="dashboard-card permissions-card">
      <div className="sec-hdr">
        <h3>Permissions</h3>
      </div>
      {summary.totalDecisions === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-summary">
          <div className="metric-row">
            <span className="metric-label">Decisions</span>
            <span className="metric-value">{summary.totalDecisions} total</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Auto-approved</span>
            <span className="metric-value">{summary.autoApproved} ({formatPercentage(summary.autoRate)})</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">User-approved</span>
            <span className="metric-value">{summary.userApproved}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Rejected</span>
            <span className="metric-value">{summary.rejected}</span>
          </div>
        </div>
      )}
    </div>
  );
};
