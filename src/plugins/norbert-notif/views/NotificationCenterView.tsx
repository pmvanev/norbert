/// NotificationCenterView -- main view for the norbert-notif plugin.
///
/// Shows recent notification history and DND status.
/// Uses sec-hdr pattern for the title area per project feedback.
/// Unicode symbols (not emoji) for icons.

import { useState, useCallback, type FC } from "react";
import type { DispatchInstruction, DndConfig } from "../domain/types";
import { evaluateDndState } from "../domain/dndManager";
import { Icon } from "../../../components/Icon";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NotificationCenterViewProps {
  readonly notifications: readonly DispatchInstruction[];
  readonly dndConfig: DndConfig;
  readonly onToggleDnd: () => void;
}

// ---------------------------------------------------------------------------
// Default DND config (off)
// ---------------------------------------------------------------------------

const DEFAULT_DND_CONFIG: DndConfig = {
  manuallyEnabled: false,
  scheduleEnabled: false,
  schedule: [],
  behavior: "queue_with_badge",
};

// ---------------------------------------------------------------------------
// Notification row
// ---------------------------------------------------------------------------

const NotificationRow: FC<{ readonly instruction: DispatchInstruction }> = ({ instruction }) => (
  <div className="notif-row">
    <div className="notif-row-header">
      <Icon name={CHANNEL_ICON_MAP[instruction.channel] ?? "circle"} size={12} className="notif-row-channel" />
      <span className="notif-row-title">{instruction.title}</span>
      <span className="notif-row-time">{formatTime(instruction.timestamp)}</span>
    </div>
    <p className="notif-row-body">{instruction.body}</p>
  </div>
);

const CHANNEL_ICON_MAP: Readonly<Record<string, string>> = {
  toast: "monitor",
  banner: "layout",
  badge: "circle",
  email: "mail",
  webhook: "webhook",
};

const formatTime = (iso: string): string => {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NotificationCenterView: FC<NotificationCenterViewProps> = ({
  notifications,
  dndConfig,
  onToggleDnd,
}) => {
  const dndState = evaluateDndState(dndConfig, new Date());

  return (
    <div className="config-viewer" role="region" aria-label="Notification Center">
      <div className="sec-hdr">
        <span className="sec-t">Notification Center</span>
        <button
          className="config-reload-btn"
          onClick={onToggleDnd}
          type="button"
          title={dndState.active ? "Disable Do Not Disturb" : "Enable Do Not Disturb"}
          aria-label={dndState.active ? "Disable Do Not Disturb" : "Enable Do Not Disturb"}
        >
          <Icon name={dndState.active ? "bell-off" : "bell"} size={12} />
        </button>
      </div>

      {dndState.active && (
        <div className="notif-dnd-banner">
          <span className="notif-dnd-icon"><Icon name="bell-off" size={14} /></span>
          <span className="notif-dnd-label">
            Do Not Disturb is on
            {dndState.source === "schedule" && dndState.endsAt ? ` (until ${dndState.endsAt})` : ""}
          </span>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="config-empty-state" role="status">
          <span className="config-empty-icon"><Icon name="bell" size={24} /></span>
          <span className="config-empty-category">No notifications</span>
          <span className="config-empty-guidance">
            Notifications will appear here when events occur during your Claude Code sessions.
          </span>
        </div>
      ) : (
        <div className="notif-list">
          {notifications.map((n, i) => (
            <NotificationRow key={`${n.eventId}-${n.timestamp}-${i}`} instruction={n} />
          ))}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Standalone wrapper (for view registry -- no props)
// ---------------------------------------------------------------------------

/// Standalone version that manages its own state.
/// Used by the App.tsx view registry wrapper.
export const NotificationCenterStandalone: FC = () => {
  const [dndConfig, setDndConfig] = useState<DndConfig>(DEFAULT_DND_CONFIG);
  const [notifications] = useState<readonly DispatchInstruction[]>([]);

  const handleToggleDnd = useCallback(() => {
    setDndConfig((current) => ({
      ...current,
      manuallyEnabled: !current.manuallyEnabled,
    }));
  }, []);

  return (
    <NotificationCenterView
      notifications={notifications}
      dndConfig={dndConfig}
      onToggleDnd={handleToggleDnd}
    />
  );
};
