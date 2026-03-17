/// Notification event source registry.
///
/// Defines the set of hook names that norbert-notif listens to for
/// notification events. Each event source maps a hook name to a
/// human-readable label describing the event category.
///
/// Pure data -- no side effects, no imports from outside the plugin.

// ---------------------------------------------------------------------------
// NotificationEventSource — descriptor for a hookable event source
// ---------------------------------------------------------------------------

/// A notification event source binding a hook name to its display label.
export interface NotificationEventSource {
  readonly hookName: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Event source definitions
// ---------------------------------------------------------------------------

/// The notification event sources that norbert-notif registers hook
/// processors for. Each entry results in one api.hooks.register() call
/// during plugin onLoad.
export const NOTIFICATION_EVENT_SOURCES: readonly NotificationEventSource[] = [
  { hookName: "session-event", label: "Session Events" },
  { hookName: "config-change", label: "Configuration Changes" },
  { hookName: "plugin-lifecycle", label: "Plugin Lifecycle" },
] as const;
