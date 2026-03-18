/**
 * PMAggregateGrid: 2x2 chart grid with session breakdown panel.
 *
 * Renders four PMChart cells (tokens/s, cost/min, agents, context) in a
 * 2x2 grid layout, plus a per-session breakdown panel listing individual
 * session metrics sorted by token rate descending.
 *
 * Data flows from AggregateMetrics (pure domain type) through the grid.
 * No direct IO -- all data arrives via props.
 */

import type { RateSample, AggregateMetrics, SessionSummary } from "../domain/types";
import { computeCostRatePerMinute } from "../domain/performanceMonitor";
import { formatRateOverlay } from "../domain/oscilloscope";
import { PMChart } from "./PMChart";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMAggregateGridProps {
  readonly aggregate: AggregateMetrics;
  readonly tokenRateSamples: ReadonlyArray<RateSample>;
  readonly costRateSamples: ReadonlyArray<RateSample>;
}

// ---------------------------------------------------------------------------
// Formatting helpers (pure)
// ---------------------------------------------------------------------------

const formatCostPerMinute = (costRatePerSecond: number): string => {
  const perMin = computeCostRatePerMinute(costRatePerSecond);
  if (perMin === 0) return "$0.00/min";
  if (perMin < 0.01) return `$${perMin.toFixed(4)}/min`;
  return `$${perMin.toFixed(2)}/min`;
};

const formatAgentCount = (count: number): string =>
  `${count} agent${count !== 1 ? "s" : ""}`;

const formatSessionCount = (count: number): string =>
  `${count} session${count !== 1 ? "s" : ""}`;

const truncateSessionId = (sessionId: string, maxLength: number = 20): string =>
  sessionId.length > maxLength
    ? `${sessionId.slice(0, maxLength - 1)}...`
    : sessionId;

// ---------------------------------------------------------------------------
// Session Breakdown Row
// ---------------------------------------------------------------------------

const SessionRow = ({ session }: { readonly session: SessionSummary }) => (
  <div className="pm-session-row" role="listitem">
    <span className="pm-session-id" data-mono="">
      {truncateSessionId(session.sessionId)}
    </span>
    <span className="pm-session-rate" data-mono="">
      {formatRateOverlay(session.tokenRate)}
    </span>
    <span className="pm-session-cost" data-mono="">
      {formatCostPerMinute(session.costRate)}
    </span>
    <span className="pm-session-agents" data-mono="">
      {session.activeAgentCount}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMAggregateGrid = ({
  aggregate,
  tokenRateSamples,
  costRateSamples,
}: PMAggregateGridProps) => {
  const costPerMinLabel = formatCostPerMinute(aggregate.totalCostRate);
  const agentLabel = formatAgentCount(aggregate.totalActiveAgents);

  return (
    <div className="pm-aggregate" role="region" aria-label="Aggregate performance metrics">
      {/* 2x2 Chart Grid */}
      <div className="pm-grid" role="group" aria-label="Metric charts">
        <PMChart
          title="Tokens/s"
          samples={tokenRateSamples}
          field="tokenRate"
          color="var(--brand, #00e5cc)"
          valueLabel={formatRateOverlay(aggregate.totalTokenRate)}
        />
        <PMChart
          title="Cost/min"
          samples={costRateSamples}
          field="costRate"
          color="var(--amber, #f0920a)"
          valueLabel={costPerMinLabel}
        />
        <PMChart
          title="Agents"
          samples={tokenRateSamples}
          field="tokenRate"
          color="var(--blue, #4a9eff)"
          valueLabel={agentLabel}
        />
        <PMChart
          title="Context"
          samples={tokenRateSamples}
          field="tokenRate"
          color="var(--text-s, #7aa89e)"
          valueLabel={formatSessionCount(aggregate.sessionCount)}
        />
      </div>

      {/* Per-session breakdown panel */}
      <div className="pm-breakdown" role="list" aria-label="Per-session breakdown">
        <div className="pm-breakdown-hdr">
          <span className="pm-breakdown-col">Session</span>
          <span className="pm-breakdown-col">Rate</span>
          <span className="pm-breakdown-col">Cost</span>
          <span className="pm-breakdown-col">Agents</span>
        </div>
        {aggregate.sessions.length === 0 ? (
          <div className="pm-breakdown-empty">No active sessions</div>
        ) : (
          aggregate.sessions.map((session) => (
            <SessionRow key={session.sessionId} session={session} />
          ))
        )}
      </div>
    </div>
  );
};
