/// PromptActivityCard: thin view wrapper for prompt activity aggregation.
///
/// Calls pure domain aggregator and renders the result.
/// No business logic in this component.

import { aggregatePromptActivity, type UserPromptEvent } from "../domain/promptActivityAggregator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromptActivityCardProps {
  readonly events: ReadonlyArray<UserPromptEvent>;
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = (): JSX.Element => (
  <div className="card-empty-state">
    <span className="card-empty-icon">{"\u2014"}</span>
    <span className="card-empty-label">No prompts recorded</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PromptActivityCard = ({ events }: PromptActivityCardProps): JSX.Element => {
  const summary = aggregatePromptActivity(events);

  return (
    <div className="dashboard-card prompt-activity-card">
      <div className="sec-hdr">
        <h3>Prompt Activity</h3>
      </div>
      {summary.totalPrompts === 0 ? (
        <EmptyState />
      ) : (
        <div className="card-summary">
          <div className="metric-row">
            <span className="metric-label">Prompts</span>
            <span className="metric-value">{summary.totalPrompts}</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Rate</span>
            <span className="metric-value">{summary.promptsPerMinute.toFixed(1)}/min</span>
          </div>
          <div className="metric-row">
            <span className="metric-label">Avg Length</span>
            <span className="metric-value">{Math.round(summary.avgLength)} chars</span>
          </div>
        </div>
      )}
    </div>
  );
};
