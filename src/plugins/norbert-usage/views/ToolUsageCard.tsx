/// ToolUsageCard: thin view wrapper for tool usage aggregation.
///
/// Calls pure domain aggregator and renders the result.
/// No business logic in this component.

import { aggregateToolUsage, type ToolResultEvent, type ToolUsageSummary } from "../domain/toolUsageAggregator";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ToolUsageCardProps {
  readonly events: ReadonlyArray<ToolResultEvent>;
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure, view-level)
// ---------------------------------------------------------------------------

const formatPercentage = (rate: number): string =>
  `${(rate * 100).toFixed(0)}%`;

const formatDuration = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const EmptyState = (): JSX.Element => (
  <div className="card-empty-state">
    <span className="card-empty-icon">{"\u2014"}</span>
    <span className="card-empty-label">No tool calls recorded</span>
  </div>
);

// ---------------------------------------------------------------------------
// Per-tool row
// ---------------------------------------------------------------------------

const ToolRow = ({
  toolName,
  count,
  avgDurationMs,
  successRate,
}: {
  readonly toolName: string;
  readonly count: number;
  readonly avgDurationMs: number;
  readonly successRate: number;
}): JSX.Element => (
  <div className="tool-row">
    <span className="tool-name">{toolName}</span>
    <span className="tool-count">{count} {count === 1 ? "call" : "calls"}</span>
    <span className="tool-duration">{formatDuration(avgDurationMs)} avg</span>
    <span className="tool-status">{successRate === 1 ? "OK" : formatPercentage(successRate)}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Summary header
// ---------------------------------------------------------------------------

const SummaryHeader = ({ summary }: { readonly summary: ToolUsageSummary }): JSX.Element => (
  <div className="card-summary">
    <span>Tools: {summary.perToolBreakdown.size} types, {summary.totalCalls} calls</span>
    <span>Success Rate: {formatPercentage(summary.successRate)}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ToolUsageCard = ({ events }: ToolUsageCardProps): JSX.Element => {
  const summary = aggregateToolUsage(events);

  return (
    <div className="dashboard-card tool-usage-card">
      <div className="sec-hdr">
        <h3>Tool Usage</h3>
      </div>
      {summary.totalCalls === 0 ? (
        <EmptyState />
      ) : (
        <>
          <SummaryHeader summary={summary} />
          <div className="tool-breakdown">
            {Array.from(summary.perToolBreakdown.entries())
              .sort(([, a], [, b]) => b.count - a.count)
              .map(([toolName, stats]) => (
                <ToolRow
                  key={toolName}
                  toolName={toolName}
                  count={stats.count}
                  avgDurationMs={stats.avgDurationMs}
                  successRate={stats.successRate}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
};
