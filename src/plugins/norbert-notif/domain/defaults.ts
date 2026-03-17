/// Default notification event metadata and formatting.
///
/// Defines the event registry with display labels, title/body formatters,
/// and default preference values for each notification event type.
///
/// Pure data and pure functions -- no side effects.

import type { NotificationEventId } from "./types";

// ---------------------------------------------------------------------------
// Event display metadata
// ---------------------------------------------------------------------------

export interface EventDisplayMetadata {
  readonly eventId: NotificationEventId;
  readonly title: string;
  readonly formatBody: (payload: Record<string, unknown>) => string;
}

const formatSessionName = (payload: Record<string, unknown>): string =>
  typeof payload.sessionName === "string" ? payload.sessionName : "unknown session";

const formatOptionalField = (
  payload: Record<string, unknown>,
  field: string,
  prefix: string
): string => {
  const value = payload[field];
  return value !== undefined && value !== null ? `${prefix}${value}` : "";
};

/// Registry of event display metadata, keyed by event ID.
export const EVENT_DISPLAY_REGISTRY: readonly EventDisplayMetadata[] = [
  {
    eventId: "session_response_completed",
    title: "Session Response Completed",
    formatBody: (payload) => {
      const sessionName = formatSessionName(payload);
      const parts = [sessionName];
      const duration = formatOptionalField(payload, "duration", "Duration: ");
      if (duration) parts.push(duration);
      const cost = formatOptionalField(payload, "cost", "Cost: $");
      if (cost) parts.push(cost);
      return parts.join(" | ");
    },
  },
  {
    eventId: "session_started",
    title: "Session Started",
    formatBody: (payload) => formatSessionName(payload),
  },
  {
    eventId: "context_compaction_occurred",
    title: "Context Compaction",
    formatBody: (payload) =>
      `Context compacted in ${formatSessionName(payload)}`,
  },
  {
    eventId: "cost_threshold_reached",
    title: "Cost Threshold Reached",
    formatBody: (payload) => {
      const sessionName = formatSessionName(payload);
      const cost =
        typeof payload.cost === "number" ? payload.cost.toFixed(2) : "?";
      const threshold =
        typeof payload.threshold === "number"
          ? payload.threshold.toFixed(2)
          : "?";
      return `${sessionName} | Cost: $${cost} (threshold: $${threshold})`;
    },
  },
  {
    eventId: "hook_error_detected",
    title: "Hook Error Detected",
    formatBody: (payload) => {
      const hookName =
        typeof payload.hookName === "string" ? payload.hookName : "unknown hook";
      const errorMessage =
        typeof payload.errorMessage === "string"
          ? payload.errorMessage
          : "Unknown error";
      const sessionName = formatSessionName(payload);
      return `${hookName}: ${errorMessage} (session: ${sessionName})`;
    },
  },
  {
    eventId: "hook_timeout",
    title: "Hook Timeout",
    formatBody: (payload) => {
      const hookName =
        typeof payload.hookName === "string" ? payload.hookName : "unknown hook";
      return `Hook "${hookName}" timed out in ${formatSessionName(payload)}`;
    },
  },
  {
    eventId: "des_enforcement_block",
    title: "DES Enforcement Block",
    formatBody: (payload) =>
      `Enforcement block in ${formatSessionName(payload)}`,
  },
  {
    eventId: "agent_spawned",
    title: "Agent Spawned",
    formatBody: (payload) =>
      `Agent spawned in ${formatSessionName(payload)}`,
  },
  {
    eventId: "agent_completed",
    title: "Agent Completed",
    formatBody: (payload) =>
      `Agent completed in ${formatSessionName(payload)}`,
  },
  {
    eventId: "token_count_threshold",
    title: "Token Count Threshold",
    formatBody: (payload) =>
      `Token threshold reached in ${formatSessionName(payload)}`,
  },
  {
    eventId: "context_window_threshold",
    title: "Context Window Threshold",
    formatBody: (payload) =>
      `Context window threshold in ${formatSessionName(payload)}`,
  },
  {
    eventId: "anomaly_detected",
    title: "Anomaly Detected",
    formatBody: (payload) =>
      `Anomaly detected in ${formatSessionName(payload)}`,
  },
  {
    eventId: "session_digest_ready",
    title: "Session Digest Ready",
    formatBody: (payload) =>
      `Digest ready for ${formatSessionName(payload)}`,
  },
  {
    eventId: "credit_balance_low",
    title: "Credit Balance Low",
    formatBody: (payload) => {
      const balance =
        typeof payload.balance === "number"
          ? `$${payload.balance.toFixed(2)}`
          : "low";
      return `Credit balance is ${balance}`;
    },
  },
] as const;

/// Look up event display metadata by event ID.
export const findEventDisplay = (
  eventId: string
): EventDisplayMetadata | undefined =>
  EVENT_DISPLAY_REGISTRY.find((entry) => entry.eventId === eventId);
