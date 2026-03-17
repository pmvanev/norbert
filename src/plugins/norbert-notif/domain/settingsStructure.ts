/// Settings section structure for the notifications plugin.
///
/// Pure data defining the settings view identity and its sub-sections.
/// Used by the plugin's onLoad to register a settings view and by the
/// StatusBarItem view component to render the settings panel.

// ---------------------------------------------------------------------------
// SettingsSubSection — a named sub-section within the settings view
// ---------------------------------------------------------------------------

/// A sub-section of the notifications settings view.
export interface SettingsSubSection {
  readonly id: string;
  readonly label: string;
}

// ---------------------------------------------------------------------------
// Settings view constants
// ---------------------------------------------------------------------------

/// The view id for the notifications settings panel.
export const NOTIF_SETTINGS_VIEW_ID = "notif-settings";

/// The display label for the settings view (used as sec-hdr title).
export const NOTIF_SETTINGS_VIEW_LABEL = "Notifications";

/// The icon for the settings view.
export const NOTIF_SETTINGS_VIEW_ICON = "\u2699"; // gear symbol

/// The three sub-sections of the notifications settings view.
export const NOTIF_SETTINGS_SUB_SECTIONS: readonly SettingsSubSection[] = [
  { id: "events", label: "Events" },
  { id: "channels", label: "Channels" },
  { id: "dnd", label: "Do Not Disturb" },
] as const;
