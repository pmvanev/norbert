/// Domain types for norbert-notif notification center.
///
/// All types are readonly/immutable following functional paradigm.
/// Algebraic data types and discriminated unions for type safety.
///
/// Pure data definitions -- no side effects, no imports from outside the plugin.

// ---------------------------------------------------------------------------
// Notification Event Types
// ---------------------------------------------------------------------------

export type NotificationEventCategory =
  | "session"
  | "cost"
  | "error"
  | "agent"
  | "system";

export type NotificationEventId =
  | "session_response_completed"
  | "session_started"
  | "context_compaction_occurred"
  | "token_count_threshold"
  | "cost_threshold_reached"
  | "context_window_threshold"
  | "hook_error_detected"
  | "hook_timeout"
  | "des_enforcement_block"
  | "agent_spawned"
  | "agent_completed"
  | "anomaly_detected"
  | "session_digest_ready"
  | "credit_balance_low";

export interface NotificationEvent {
  readonly id: NotificationEventId;
  readonly label: string;
  readonly category: NotificationEventCategory;
  readonly hasThreshold: boolean;
  readonly thresholdUnit: string | null;
  readonly defaultThreshold: number | null;
}

// ---------------------------------------------------------------------------
// Channel Types
// ---------------------------------------------------------------------------

export type BuiltInChannelId = "toast" | "banner" | "badge";
export type AdvancedChannelId = "email" | "webhook";
export type ChannelId = BuiltInChannelId | AdvancedChannelId;

export type ChannelStatus = "active" | "configured" | "not_configured" | "error";

// ---------------------------------------------------------------------------
// Sound Types
// ---------------------------------------------------------------------------

export type BuiltInSoundName =
  | "phosphor-ping"
  | "amber-pulse"
  | "compaction"
  | "session-complete"
  | "des-block"
  | "silence";

export interface SoundEntry {
  readonly name: string;
  readonly source: "built-in" | "custom";
  readonly filePath: string | null;
}

// ---------------------------------------------------------------------------
// User Preferences
// ---------------------------------------------------------------------------

export interface ChannelToggles {
  readonly toast: boolean;
  readonly banner: boolean;
  readonly badge: boolean;
  readonly email: boolean;
  readonly webhook: boolean;
}

export interface EventPreference {
  readonly eventId: NotificationEventId;
  readonly channels: ChannelToggles;
  readonly sound: string;
  readonly threshold: number | null;
}

export interface NotificationPreferences {
  readonly version: 1;
  readonly events: readonly EventPreference[];
  readonly globalVolume: number;
}

// ---------------------------------------------------------------------------
// DND State
// ---------------------------------------------------------------------------

export type DndBehavior = "queue_with_badge" | "discard_silently" | "banner_only";

export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface DndScheduleEntry {
  readonly day: DayOfWeek;
  readonly enabled: boolean;
  readonly startTime: string | null;
  readonly endTime: string | null;
}

export interface DndConfig {
  readonly manuallyEnabled: boolean;
  readonly scheduleEnabled: boolean;
  readonly schedule: readonly DndScheduleEntry[];
  readonly behavior: DndBehavior;
}

export interface DndState {
  readonly active: boolean;
  readonly source: "manual" | "schedule" | "none";
  readonly endsAt: string | null;
  readonly queuedCount: number;
}

// ---------------------------------------------------------------------------
// Dispatch Engine Types
// ---------------------------------------------------------------------------

export type DispatchChannel = ChannelId;

export interface DispatchInstruction {
  readonly channel: DispatchChannel;
  readonly title: string;
  readonly body: string;
  readonly sound: string | null;
  readonly volume: number;
  readonly isTest: boolean;
  readonly eventId: NotificationEventId;
  readonly metadata: Record<string, unknown>;
}

export type DispatchResult =
  | { readonly ok: true; readonly channel: DispatchChannel; readonly timestamp: string }
  | { readonly ok: false; readonly channel: DispatchChannel; readonly error: string; readonly timestamp: string };

// ---------------------------------------------------------------------------
// Hook Event (incoming from hookBridge)
// ---------------------------------------------------------------------------

export interface HookEvent {
  readonly hookName: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}
