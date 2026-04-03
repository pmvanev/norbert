/// SessionDashboard: layout shell composing all session dashboard cards.
///
/// Accepts a session's events (pre-fetched by parent), filters by event_type,
/// and distributes to the appropriate card components.
///
/// This is a thin orchestration layer -- all domain logic lives in the
/// pure aggregator modules.

import { useMemo } from "react";
import type { ToolResultEvent } from "../domain/toolUsageAggregator";
import type { ApiErrorEvent } from "../domain/apiHealthAggregator";
import type { UserPromptEvent } from "../domain/promptActivityAggregator";
import type { ToolDecisionEvent } from "../domain/permissionsAggregator";
import type { AccumulatedMetric } from "../domain/activeTimeFormatter";
import { ToolUsageCard } from "./ToolUsageCard";
import { ApiHealthCard } from "./ApiHealthCard";
import { PromptActivityCard } from "./PromptActivityCard";
import { PermissionsCard } from "./PermissionsCard";
import { ActiveTimeCard } from "./ActiveTimeCard";
import { ProductivityCard } from "./ProductivityCard";

// ---------------------------------------------------------------------------
// Generic event shape from the backend
// ---------------------------------------------------------------------------

export interface SessionEvent {
  readonly event_type: string;
  readonly payload: Record<string, unknown>;
  readonly received_at: string;
}

// ---------------------------------------------------------------------------
// Event filtering (pure functions)
// ---------------------------------------------------------------------------

const filterByEventType = <T extends string>(
  events: ReadonlyArray<SessionEvent>,
  eventType: T,
): ReadonlyArray<SessionEvent> =>
  events.filter((e) => e.event_type === eventType);

const toToolResultEvents = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<ToolResultEvent> =>
  filterByEventType(events, "tool_result").map((e) => ({
    eventType: "tool_result" as const,
    payload: e.payload as ToolResultEvent["payload"],
    receivedAt: e.received_at,
  }));

const toApiErrorEvents = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<ApiErrorEvent> =>
  filterByEventType(events, "api_error").map((e) => ({
    eventType: "api_error" as const,
    payload: e.payload as ApiErrorEvent["payload"],
    receivedAt: e.received_at,
  }));

const toUserPromptEvents = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<UserPromptEvent> =>
  filterByEventType(events, "user_prompt").map((e) => ({
    eventType: "user_prompt" as const,
    payload: e.payload as UserPromptEvent["payload"],
    receivedAt: e.received_at,
  }));

const toToolDecisionEvents = (events: ReadonlyArray<SessionEvent>): ReadonlyArray<ToolDecisionEvent> =>
  filterByEventType(events, "tool_decision").map((e) => ({
    eventType: "tool_decision" as const,
    payload: e.payload as ToolDecisionEvent["payload"],
    receivedAt: e.received_at,
  }));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SessionDashboardProps {
  readonly sessionId: string;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly metrics: ReadonlyArray<AccumulatedMetric>;
  readonly totalApiRequests: number;
  readonly onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SessionDashboard = ({
  sessionId,
  events,
  metrics,
  totalApiRequests,
  onClose,
}: SessionDashboardProps): JSX.Element => {
  const toolResultEvents = useMemo(() => toToolResultEvents(events), [events]);
  const apiErrorEvents = useMemo(() => toApiErrorEvents(events), [events]);
  const userPromptEvents = useMemo(() => toUserPromptEvents(events), [events]);
  const toolDecisionEvents = useMemo(() => toToolDecisionEvents(events), [events]);

  return (
    <div className="session-dashboard">
      <div className="sec-hdr">
        <h2>Session: {sessionId.slice(0, 8)}</h2>
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
      <div className="dashboard-grid">
        <ActiveTimeCard metrics={metrics} />
        <ToolUsageCard events={toolResultEvents} />
        <PromptActivityCard events={userPromptEvents} />
        <ApiHealthCard events={apiErrorEvents} totalApiRequests={totalApiRequests} />
        <PermissionsCard events={toolDecisionEvents} />
        <ProductivityCard metrics={metrics} />
      </div>
    </div>
  );
};
