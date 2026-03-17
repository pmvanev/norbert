/// Default notification event metadata and formatting.
///
/// Defines the event registry with display labels, title/body formatters,
/// and default preference values for each notification event type.
///
/// Pure data and pure functions -- no side effects.

import type {
  NotificationEventId,
  NotificationPreferences,
  EventPreference,
  ChannelToggles,
} from "./types";

// ---------------------------------------------------------------------------
// Event display metadata
// ---------------------------------------------------------------------------

export interface EventDisplayMetadata {
  readonly eventId: NotificationEventId;
  readonly title: string;
  readonly formatBody: (payload: Readonly<Record<string, unknown>>) => string;
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

// ---------------------------------------------------------------------------
// Default preferences
// ---------------------------------------------------------------------------

/// Channel toggles with all channels disabled.
const allChannelsOff: ChannelToggles = {
  toast: false,
  banner: false,
  badge: false,
  email: false,
  webhook: false,
} as const;

/// Channel toggles with only toast enabled.
const toastOnly: ChannelToggles = {
  ...allChannelsOff,
  toast: true,
} as const;

/// Channel toggles with toast, banner, and badge enabled.
const toastBannerBadge: ChannelToggles = {
  ...allChannelsOff,
  toast: true,
  banner: true,
  badge: true,
} as const;

/// Create an event preference with disabled channels and silence.
const disabledEvent = (eventId: NotificationEventId): EventPreference => ({
  eventId,
  channels: allChannelsOff,
  sound: "silence",
  threshold: null,
});

/// Default event preferences matching the product specification.
///
/// Enabled events (On):
///   session_response_completed  -- Toast, phosphor-ping
///   context_compaction_occurred -- Toast, compaction
///   cost_threshold_reached      -- Toast+Banner+Badge, amber-pulse, $5.00
///   context_window_threshold    -- Toast+Banner+Badge, amber-pulse, 75%
///   hook_error_detected         -- Toast+Banner+Badge, des-block
///   hook_timeout                -- Toast+Banner+Badge, des-block
///   des_enforcement_block       -- Toast+Banner+Badge, des-block
///   anomaly_detected            -- Toast+Banner+Badge, amber-pulse
///   credit_balance_low          -- Toast+Banner+Badge, amber-pulse
///
/// Disabled events (Off):
///   session_started, token_count_threshold, agent_spawned,
///   agent_completed, session_digest_ready
const DEFAULT_EVENT_PREFERENCES: readonly EventPreference[] = [
  {
    eventId: "session_response_completed",
    channels: toastOnly,
    sound: "phosphor-ping",
    threshold: null,
  },
  disabledEvent("session_started"),
  {
    eventId: "context_compaction_occurred",
    channels: toastOnly,
    sound: "compaction",
    threshold: null,
  },
  disabledEvent("token_count_threshold"),
  {
    eventId: "cost_threshold_reached",
    channels: toastBannerBadge,
    sound: "amber-pulse",
    threshold: 5.0,
  },
  {
    eventId: "context_window_threshold",
    channels: toastBannerBadge,
    sound: "amber-pulse",
    threshold: 75,
  },
  {
    eventId: "hook_error_detected",
    channels: toastBannerBadge,
    sound: "des-block",
    threshold: null,
  },
  {
    eventId: "hook_timeout",
    channels: toastBannerBadge,
    sound: "des-block",
    threshold: null,
  },
  {
    eventId: "des_enforcement_block",
    channels: toastBannerBadge,
    sound: "des-block",
    threshold: null,
  },
  disabledEvent("agent_spawned"),
  disabledEvent("agent_completed"),
  {
    eventId: "anomaly_detected",
    channels: toastBannerBadge,
    sound: "amber-pulse",
    threshold: null,
  },
  disabledEvent("session_digest_ready"),
  {
    eventId: "credit_balance_low",
    channels: toastBannerBadge,
    sound: "amber-pulse",
    threshold: null,
  },
] as const;

/// Pre-computed default preferences constant.
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  version: 1,
  events: DEFAULT_EVENT_PREFERENCES,
  globalVolume: 100,
} as const;

/// Generate first-launch default preferences for all notification events.
export const applyDefaultPreferences = (): NotificationPreferences =>
  DEFAULT_PREFERENCES;
