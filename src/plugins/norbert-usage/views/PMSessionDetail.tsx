/**
 * PMSessionDetail: session-scoped detail view for the Performance Monitor.
 *
 * Renders session-scoped charts (tokens/s, cost/min), an agent breakdown
 * panel when agent data is available, operational metrics bar, and back
 * navigation. Handles graceful degradation when agent data is absent
 * and shows a frozen state indicator for ended sessions.
 *
 * Pure presentation component -- all data arrives via props from domain
 * functions (computeSessionDetailData). No IO imports.
 */

import type { SessionDetailData, RateSample, AgentMetrics } from "../domain/types";
import { computeCostRatePerMinute } from "../domain/performanceMonitor";
import { formatRateOverlay } from "../domain/oscilloscope";
import { PMChart } from "./PMChart";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PMSessionDetailProps {
  readonly detailData: SessionDetailData;
  readonly tokenRateSamples: ReadonlyArray<RateSample>;
  readonly costRateSamples: ReadonlyArray<RateSample>;
  readonly onBack: () => void;
  readonly isEnded?: boolean;
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

const formatContextWindow = (pct: number): string =>
  `${Math.round(pct)}%`;

// ---------------------------------------------------------------------------
// Agent Row
// ---------------------------------------------------------------------------

const AgentRow = ({ agent }: { readonly agent: AgentMetrics }) => (
  <div className="pm-agent-row" role="listitem">
    <span className="pm-agent-role" data-mono="">
      {agent.agentRole}
    </span>
    <span className="pm-agent-rate" data-mono="">
      {formatRateOverlay(agent.tokenRate)}
    </span>
    <span className="pm-agent-cost" data-mono="">
      {formatCostPerMinute(agent.costRate)}
    </span>
    <span className="pm-agent-tokens" data-mono="">
      {agent.tokenTotal.toLocaleString()}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Agent Breakdown Panel
// ---------------------------------------------------------------------------

const AgentBreakdown = ({
  agents,
}: {
  readonly agents: ReadonlyArray<AgentMetrics>;
}) => (
  <div className="pm-agent-breakdown" role="list" aria-label="Agent breakdown">
    <div className="pm-agent-hdr">
      <span className="pm-agent-col">Role</span>
      <span className="pm-agent-col">Rate</span>
      <span className="pm-agent-col">Cost</span>
      <span className="pm-agent-col">Tokens</span>
    </div>
    {agents.length === 0 ? (
      <div className="pm-agent-empty">No agent data available</div>
    ) : (
      agents.map((agent) => (
        <AgentRow key={agent.agentId} agent={agent} />
      ))
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Operational Metrics Bar
// ---------------------------------------------------------------------------

const OperationalMetrics = ({
  detailData,
  isEnded,
}: {
  readonly detailData: SessionDetailData;
  readonly isEnded: boolean;
}) => (
  <div className="pm-ops-bar" role="status" aria-label="Operational metrics">
    <span className="pm-ops-item" data-mono="">
      Context: {formatContextWindow(detailData.metrics.contextWindowPct)}
    </span>
    <span className="pm-ops-item" data-mono="">
      Agents: {detailData.metrics.activeAgentCount}
    </span>
    <span className="pm-ops-item" data-mono="">
      Cost: ${detailData.metrics.sessionCost.toFixed(2)}
    </span>
    {isEnded && (
      <span className="pm-ops-ended" data-mono="">
        Session ended
      </span>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PMSessionDetail = ({
  detailData,
  tokenRateSamples,
  costRateSamples,
  onBack,
  isEnded = false,
}: PMSessionDetailProps) => {
  const burnRateLabel = formatRateOverlay(detailData.metrics.burnRate);
  const costLabel = formatCostPerMinute(
    detailData.metrics.sessionCost > 0 && detailData.metrics.totalTokens > 0
      ? (detailData.metrics.sessionCost / detailData.metrics.totalTokens) * detailData.metrics.burnRate
      : 0,
  );

  return (
    <div
      className="pm-session-detail"
      role="region"
      aria-label={`Session detail: ${detailData.sessionId}`}
    >
      {/* Back navigation */}
      <div className="pm-detail-nav">
        <button
          className="pm-back-btn"
          onClick={onBack}
          aria-label="Back to aggregate view"
        >
          &#x2190; Back
        </button>
        <span className="pm-detail-title" data-mono="">
          {detailData.sessionId}
        </span>
      </div>

      {/* Session-scoped charts */}
      <div className="pm-detail-charts" role="group" aria-label="Session charts">
        <PMChart
          title="Tokens/s"
          samples={tokenRateSamples}
          field="tokenRate"
          color="var(--brand, #00e5cc)"
          valueLabel={burnRateLabel}
        />
        <PMChart
          title="Cost/min"
          samples={costRateSamples}
          field="costRate"
          color="var(--amber, #f0920a)"
          valueLabel={costLabel}
        />
      </div>

      {/* Operational metrics bar */}
      <OperationalMetrics detailData={detailData} isEnded={isEnded} />

      {/* Agent breakdown panel */}
      <AgentBreakdown agents={detailData.agents} />
    </div>
  );
};
