/// Status bar data model for notifications.
///
/// Pure functions that format DND state and unread count into
/// status bar label and icon strings. No side effects.

// ---------------------------------------------------------------------------
// NotificationStatus — immutable snapshot of notification state
// ---------------------------------------------------------------------------

/// The current notification status: DND toggle and unread banner count.
export interface NotificationStatus {
  readonly dndEnabled: boolean;
  readonly unreadCount: number;
}

// ---------------------------------------------------------------------------
// Status bar formatting — pure functions
// ---------------------------------------------------------------------------

/// Unicode bell symbol for normal mode.
const BELL_ICON = "\u2407";

/// Unicode empty set symbol for DND mode (muted).
const MUTED_ICON = "\u2205";

/// Formats the status bar label from notification status.
/// Example: "DND off \u00B7 3" or "DND on \u00B7 0"
export const formatStatusLabel = (status: NotificationStatus): string => {
  const dndText = status.dndEnabled ? "DND on" : "DND off";
  return `${dndText} \u00B7 ${status.unreadCount}`;
};

/// Formats the status bar icon based on DND state.
/// Bell when DND is off, empty-set when DND is on.
export const formatStatusIcon = (dndEnabled: boolean): string =>
  dndEnabled ? MUTED_ICON : BELL_ICON;
