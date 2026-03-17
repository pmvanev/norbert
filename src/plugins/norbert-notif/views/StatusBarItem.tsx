/// StatusBarItem — notification status bar indicator view.
///
/// Renders the DND state and unread count in the status bar.
/// Uses the sec-hdr pattern for the settings title area.
/// Unicode symbols (not emoji) for icons per project conventions.

import type { FC } from "react";
import {
  formatStatusLabel,
  formatStatusIcon,
  type NotificationStatus,
} from "../domain/statusBarData";
import {
  NOTIF_SETTINGS_VIEW_LABEL,
  NOTIF_SETTINGS_SUB_SECTIONS,
} from "../domain/settingsStructure";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StatusBarItemProps {
  readonly status: NotificationStatus;
}

// ---------------------------------------------------------------------------
// StatusBarItem component
// ---------------------------------------------------------------------------

/// Displays the current notification status in the status bar.
/// Shows DND state and unread count as a compact label.
export const StatusBarItem: FC<StatusBarItemProps> = ({ status }) => {
  const label = formatStatusLabel(status);
  const icon = formatStatusIcon(status.dndEnabled);

  return (
    <span title={label}>
      {icon} {label}
    </span>
  );
};

// ---------------------------------------------------------------------------
// NotificationSettingsPanel component
// ---------------------------------------------------------------------------

/// Renders the notification settings panel with sec-hdr title
/// and sub-sections for Events, Channels, and Do Not Disturb.
export const NotificationSettingsPanel: FC = () => (
  <div>
    <div className="sec-hdr">
      <h2>{NOTIF_SETTINGS_VIEW_LABEL}</h2>
    </div>
    {NOTIF_SETTINGS_SUB_SECTIONS.map((section) => (
      <section key={section.id}>
        <h3>{section.label}</h3>
      </section>
    ))}
  </div>
);
