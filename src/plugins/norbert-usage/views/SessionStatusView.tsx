/// SessionStatusView: combined per-session status panel.
///
/// Merges the former Gauge Cluster and Session Usage (Session Dashboard)
/// views into a single secondary-panel view shown when a session is selected
/// in the Sessions list. All metrics are rendered as compact gauge-style
/// tiles: burn rate, context, cost, active agents, data health, events,
/// active time split, tool usage, prompts, api errors, permissions,
/// and productivity.

import type { GaugeClusterData, FuelGaugeData } from "../domain/gaugeCluster";
import type { Urgency } from "../domain/types";
import type { AccumulatedMetric } from "../domain/activeTimeFormatter";
import { formatActiveTime } from "../domain/activeTimeFormatter";
import { formatProductivity } from "../domain/productivityFormatter";
import { aggregateToolUsage, type ToolResultEvent } from "../domain/toolUsageAggregator";
import { aggregatePromptActivity, type UserPromptEvent } from "../domain/promptActivityAggregator";
import { aggregateApiHealth, type ApiErrorEvent } from "../domain/apiHealthAggregator";
import { aggregatePermissions, type ToolDecisionEvent } from "../domain/permissionsAggregator";

// Generic backend event shape used to filter into typed per-aggregator events.
export interface SessionEvent {
  readonly event_type: string;
  readonly payload: Record<string, unknown>;
  readonly received_at: string;
}

// ---------------------------------------------------------------------------
// Urgency helpers (shared with GaugeClusterView semantics)
// ---------------------------------------------------------------------------

const URGENCY_CLASS_MAP: Partial<Record<Urgency, string>> = {
  red: "gauge-urgency-red",
  amber: "gauge-urgency-amber",
};

const urgencyClass = (urgency: Urgency): string =>
  URGENCY_CLASS_MAP[urgency] ?? "gauge-urgency-normal";

const urgencyColor = (urgency: Urgency): string => {
  if (urgency === "red") return "var(--error)";
  if (urgency === "amber") return "var(--amber)";
  return "var(--brand)";
};

// ---------------------------------------------------------------------------
// SVG Arc Gauge (270° sweep)
// ---------------------------------------------------------------------------

const ARC_SIZE = 76;
const ARC_STROKE = 5;
const ARC_RADIUS = (ARC_SIZE - ARC_STROKE) / 2;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const ARC_FRACTION = 0.75;
const ARC_LENGTH = ARC_CIRCUMFERENCE * ARC_FRACTION;
const ARC_GAP = ARC_CIRCUMFERENCE - ARC_LENGTH;

const GaugeArc = ({ pct, color }: { readonly pct: number; readonly color: string }) => {
  const filled = ARC_LENGTH * Math.min(1, Math.max(0, pct));
  return (
    <svg
      className="gauge-arc-svg"
      width={ARC_SIZE}
      height={ARC_SIZE}
      viewBox={`0 0 ${ARC_SIZE} ${ARC_SIZE}`}
    >
      <circle
        cx={ARC_SIZE / 2}
        cy={ARC_SIZE / 2}
        r={ARC_RADIUS}
        fill="none"
        stroke="var(--border-card)"
        strokeWidth={ARC_STROKE}
        strokeDasharray={`${ARC_LENGTH} ${ARC_GAP}`}
        strokeLinecap="round"
      />
      <circle
        cx={ARC_SIZE / 2}
        cy={ARC_SIZE / 2}
        r={ARC_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={ARC_STROKE}
        strokeDasharray={`${filled} ${ARC_CIRCUMFERENCE - filled}`}
        strokeLinecap="round"
        className="gauge-arc-fill"
      />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Primary gauge tiles (former GaugeClusterView)
// ---------------------------------------------------------------------------

const FuelGaugeTile = ({ data }: { readonly data: FuelGaugeData }) => {
  const pct = data.value / 100;
  const color = urgencyColor(data.urgency);
  return (
    <div className={`gauge-card gauge-card-arc fuel-gauge ${urgencyClass(data.urgency)}`}>
      <div className="gauge-arc-wrap">
        <GaugeArc pct={pct} color={color} />
        <div className="gauge-arc-inner">
          <span className="gauge-value" data-mono="">{Math.round(data.value)}</span>
          <span className="gauge-unit">{data.unit}</span>
        </div>
      </div>
      <span className="gauge-label">Context</span>
      {data.tokenLabel !== "" && <span className="gauge-sublabel">{data.tokenLabel}</span>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Secondary metric tiles (former dashboard cards, now gauge-style)
// ---------------------------------------------------------------------------

/** Horizontal split bar showing two contributing percentages. */
const SplitBar = ({ a, b }: { readonly a: number; readonly b: number }) => {
  const total = a + b;
  const aPct = total > 0 ? (a / total) * 100 : 0;
  const bPct = total > 0 ? (b / total) * 100 : 0;
  return (
    <div className="gauge-splitbar">
      <span className="gauge-splitbar-a" style={{ width: `${aPct}%` }} />
      <span className="gauge-splitbar-b" style={{ width: `${bPct}%` }} />
    </div>
  );
};

const ActiveTimeTile = ({ metrics }: { readonly metrics: ReadonlyArray<AccumulatedMetric> }) => {
  const s = formatActiveTime(metrics);
  const empty = s.totalSeconds === 0;
  return (
    <div className="gauge-card">
      <span className="gauge-value gauge-value-lg" data-mono="">
        {empty ? "--" : `${Math.round(s.userPercent)}/${Math.round(s.cliPercent)}`}
      </span>
      <span className="gauge-unit">% user/cli</span>
      {!empty && <SplitBar a={s.userPercent} b={s.cliPercent} />}
      <span className="gauge-label">Active Time</span>
      <span className="gauge-sublabel">{empty ? "no data" : s.userFormatted + " / " + s.cliFormatted}</span>
    </div>
  );
};

const ToolUsageTile = ({ events }: { readonly events: ReadonlyArray<ToolResultEvent> }) => {
  const s = aggregateToolUsage(events);
  const pct = Math.round(s.successRate * 100);
  const urgency: Urgency = s.totalCalls === 0 ? "normal" : pct >= 95 ? "normal" : pct >= 80 ? "amber" : "red";
  return (
    <div className={`gauge-card ${urgencyClass(urgency)}`}>
      <span className="gauge-value gauge-value-lg" data-mono="">{s.totalCalls}</span>
      <span className="gauge-unit">calls</span>
      <span className="gauge-label">Tool Usage</span>
      <span className="gauge-sublabel">
        {s.totalCalls === 0 ? "no data" : `${pct}% success · ${s.perToolBreakdown.size} types`}
      </span>
    </div>
  );
};

const PromptActivityTile = ({ events }: { readonly events: ReadonlyArray<UserPromptEvent> }) => {
  const s = aggregatePromptActivity(events);
  return (
    <div className="gauge-card">
      <span className="gauge-value gauge-value-lg" data-mono="">{s.totalPrompts}</span>
      <span className="gauge-unit">prompts</span>
      <span className="gauge-label">Prompts</span>
      <span className="gauge-sublabel">
        {s.totalPrompts === 0 ? "no data" : `${s.promptsPerMinute.toFixed(1)}/min · ${Math.round(s.avgLength)} chars`}
      </span>
    </div>
  );
};

const ApiHealthTile = ({
  events,
  totalApiRequests,
}: {
  readonly events: ReadonlyArray<ApiErrorEvent>;
  readonly totalApiRequests: number;
}) => {
  const s = aggregateApiHealth(events, totalApiRequests);
  const pct = s.errorRate * 100;
  const urgency: Urgency = pct === 0 ? "normal" : pct < 1 ? "amber" : "red";
  return (
    <div className={`gauge-card ${urgencyClass(urgency)}`}>
      <span className={`gauge-health-dot ${urgency === "red" ? "warn" : urgency === "amber" ? "warn" : "live"}`} />
      <span className="gauge-value gauge-value-lg" data-mono="">{pct.toFixed(1)}</span>
      <span className="gauge-unit">% errors</span>
      <span className="gauge-label">API Health</span>
      <span className="gauge-sublabel">
        {s.totalApiRequests === 0 ? "no requests" : `${s.totalErrors} / ${s.totalApiRequests}`}
      </span>
    </div>
  );
};

const PermissionsTile = ({ events }: { readonly events: ReadonlyArray<ToolDecisionEvent> }) => {
  const s = aggregatePermissions(events);
  const pct = Math.round(s.autoRate * 100);
  return (
    <div className="gauge-card">
      <span className="gauge-value gauge-value-lg" data-mono="">
        {s.totalDecisions === 0 ? "--" : pct}
      </span>
      <span className="gauge-unit">% auto</span>
      <span className="gauge-label">Permissions</span>
      <span className="gauge-sublabel">
        {s.totalDecisions === 0 ? "no data" : `${s.totalDecisions} decisions · ${s.rejected} rejected`}
      </span>
    </div>
  );
};

const ProductivityTile = ({ metrics }: { readonly metrics: ReadonlyArray<AccumulatedMetric> }) => {
  const s = formatProductivity(metrics);
  const empty = s.linesAdded === 0 && s.linesRemoved === 0 && s.commits === 0 && s.pullRequests === 0;
  const netStr = s.netLines >= 0 ? `+${s.netLines}` : `${s.netLines}`;
  return (
    <div className="gauge-card">
      <span className="gauge-value gauge-value-lg" data-mono="">{empty ? "--" : netStr}</span>
      <span className="gauge-unit">net lines</span>
      <span className="gauge-label">Productivity</span>
      <span className="gauge-sublabel">
        {empty ? "no data" : `+${s.linesAdded} / -${s.linesRemoved} · ${s.commits} commits`}
      </span>
    </div>
  );
};

const EventCountTile = ({ count }: { readonly count: number }) => (
  <div className="gauge-card">
    <span className="gauge-value gauge-value-lg" data-mono="">{count}</span>
    <span className="gauge-unit">total</span>
    <span className="gauge-label">Events</span>
  </div>
);

/** Format a token count as e.g. "1.2M" / "850k" / "420". */
const formatTokenCount = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
};

const TotalTokensTile = ({
  totalTokens,
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreationTokens,
}: {
  readonly totalTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
}) => (
  <div className="gauge-card">
    <span className="gauge-value gauge-value-lg" data-mono="">{formatTokenCount(totalTokens)}</span>
    <span className="gauge-unit">billed tokens</span>
    <span className="gauge-label">Total Tokens</span>
    <span className="gauge-sublabel">
      {totalTokens === 0
        ? "no data"
        : `${formatTokenCount(inputTokens)} in · ${formatTokenCount(outputTokens)} out · ${formatTokenCount(cacheReadTokens)} cache rd · ${formatTokenCount(cacheCreationTokens)} cache wr`}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Event filters (duplicated from SessionDashboard -- kept local so we can
// remove the SessionDashboard dependency later).
// ---------------------------------------------------------------------------

const filterType = <T extends string>(
  events: ReadonlyArray<SessionEvent>,
  eventType: T,
): ReadonlyArray<SessionEvent> => events.filter((e) => e.event_type === eventType);

/** Unwrap a tool_result payload coming from the backend.
 *
 *  The OTel adapter (src-tauri/src/adapters/otel/mod.rs::extract_tool_result_payload)
 *  nests tool fields under `payload.tool`: `{tool: {tool_name, success,
 *  duration_ms, ...}}`. The toolUsageAggregator expects those fields
 *  directly on `payload`. Without this unwrap the aggregator silently
 *  reads `undefined` for tool_name (collapsing every tool to "unknown")
 *  and `undefined` for success (counting every call as a failure),
 *  which is what was driving the "0% success / 1 types" red tile. */
const unwrapToolPayload = (payload: Record<string, unknown>): ToolResultEvent["payload"] => {
  const inner = (payload as { tool?: unknown }).tool;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as ToolResultEvent["payload"];
  }
  return payload as ToolResultEvent["payload"];
};

const toToolResults = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<ToolResultEvent> =>
  filterType(events, "tool_result").map((e) => ({
    eventType: "tool_result" as const,
    payload: unwrapToolPayload(e.payload),
    receivedAt: e.received_at,
  }));

const toApiErrors = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<ApiErrorEvent> =>
  filterType(events, "api_error").map((e) => ({
    eventType: "api_error" as const,
    payload: e.payload as ApiErrorEvent["payload"],
    receivedAt: e.received_at,
  }));

const toUserPrompts = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<UserPromptEvent> =>
  filterType(events, "user_prompt").map((e) => ({
    eventType: "user_prompt" as const,
    payload: e.payload as UserPromptEvent["payload"],
    receivedAt: e.received_at,
  }));

const toToolDecisions = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<ToolDecisionEvent> =>
  filterType(events, "tool_decision").map((e) => ({
    eventType: "tool_decision" as const,
    payload: e.payload as ToolDecisionEvent["payload"],
    receivedAt: e.received_at,
  }));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SessionStatusViewProps {
  readonly sessionName: string;
  readonly eventCount: number;
  readonly totalTokens: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly metrics: ReadonlyArray<AccumulatedMetric>;
  readonly totalApiRequests: number;
  readonly gaugeData: GaugeClusterData;
  readonly onClose?: () => void;
}

export const SessionStatusView = ({
  sessionName,
  eventCount,
  totalTokens,
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreationTokens,
  events,
  metrics,
  totalApiRequests,
  gaugeData,
  onClose,
}: SessionStatusViewProps): JSX.Element => {
  const toolResults = toToolResults(events);
  const apiErrors = toApiErrors(events);
  const userPrompts = toUserPrompts(events);
  const toolDecisions = toToolDecisions(events);

  return (
    <div className="session-status">
      <div className="sec-hdr">
        <span className="sec-t">Session Status: {sessionName}</span>
        {onClose && (
          <button
            type="button"
            className="zone-close-btn"
            onClick={onClose}
            aria-label="Close panel"
          >
            &#x2715;
          </button>
        )}
      </div>

      <div className="gauge-cluster-grid">
        <FuelGaugeTile data={gaugeData.fuelGauge} />

        <div className="gauge-card odometer">
          <span className="gauge-value gauge-value-lg" data-mono="">{gaugeData.odometer.formatted}</span>
          <span className="gauge-label">Session Cost</span>
        </div>

        <TotalTokensTile
          totalTokens={totalTokens}
          inputTokens={inputTokens}
          outputTokens={outputTokens}
          cacheReadTokens={cacheReadTokens}
          cacheCreationTokens={cacheCreationTokens}
        />

        <div className="gauge-card rpm-counter">
          <div className="gauge-rpm-dots">
            {Array.from({ length: Math.min(gaugeData.rpmCounter.value, 5) }, (_, i) => (
              <span key={i} className="gauge-rpm-dot live" />
            ))}
            {gaugeData.rpmCounter.value === 0 && <span className="gauge-rpm-dot done" />}
          </div>
          <span className="gauge-value" data-mono="">{gaugeData.rpmCounter.value}</span>
          <span className="gauge-label">Active Agents</span>
        </div>

        <div
          className={`gauge-card warning-cluster ${gaugeData.warningCluster.dataHealth === "degraded" ? "gauge-urgency-amber" : "gauge-urgency-normal"}`}
        >
          <span
            className={`gauge-health-dot ${
              gaugeData.warningCluster.dataHealth === "healthy"
                ? "live"
                : gaugeData.warningCluster.dataHealth === "degraded"
                  ? "warn"
                  : "idle"
            }`}
          />
          <span className="gauge-value gauge-value-sm" data-mono="">{gaugeData.warningCluster.dataHealth}</span>
          <span className="gauge-label">Data Health</span>
        </div>

        <EventCountTile count={eventCount} />
        <ActiveTimeTile metrics={metrics} />
        <ToolUsageTile events={toolResults} />
        <PromptActivityTile events={userPrompts} />
        <ApiHealthTile events={apiErrors} totalApiRequests={totalApiRequests} />
        <PermissionsTile events={toolDecisions} />
        <ProductivityTile metrics={metrics} />
      </div>
    </div>
  );
};
