/// Application status returned from the Rust backend via Tauri IPC.
///
/// Fields match the Rust AppStatus struct's serialized JSON.
export interface AppStatus {
  readonly version: string;
  readonly status: string;
  readonly port: number;
  readonly session_count: number;
  readonly event_count: number;
}

/// Session information returned from the Rust backend via Tauri IPC.
///
/// Fields match the Rust Session struct's serialized JSON.
export interface SessionInfo {
  readonly id: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly event_count: number;
}

/// Format the application header from name and version.
///
/// Pure function: no side effects.
export function formatHeader(appName: string, version: string): string {
  return `${appName.toUpperCase()} v${version}`;
}

/// Message displayed when no plugin is connected (no sessions, no events).
export const EMPTY_STATE_MESSAGE =
  "No plugin connected. Install the Norbert plugin to get started.";

/// The command users run in Claude Code to install the Norbert plugin.
export const PLUGIN_INSTALL_COMMAND =
  "/plugin install norbert@pmvanev-plugins";

/// Determine whether the application is in the empty state (no sessions yet).
///
/// Pure function: returns true when session count is zero.
export function isEmptyState(sessionCount: number): boolean {
  return sessionCount === 0;
}

/// Format a labeled status field for display.
///
/// Pure function: produces "Label: value" strings.
export function formatField(label: string, value: string | number): string {
  return `${label}: ${value}`;
}

/// Format a duration in seconds to a human-readable string.
///
/// Pure function: converts total seconds into "Xh Ym Zs" format.
/// Omits hours when zero, but always includes minutes when hours are present.
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/// Calculate the duration in seconds between two ISO 8601 timestamps.
///
/// Pure function: returns null when ended_at is null (session still active).
export function calculateDurationSeconds(
  startedAt: string,
  endedAt: string | null
): number | null {
  if (endedAt === null) {
    return null;
  }
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return Math.floor((end - start) / 1000);
}

/// Format an ISO 8601 timestamp for display.
///
/// Pure function: converts to locale-appropriate date/time string.
export function formatSessionTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleString();
}

/// Derive the application status from the latest session.
///
/// Pure function: returns "Active session" when the latest session
/// has no ended_at timestamp, otherwise returns "Listening".
export function deriveStatus(latestSession: SessionInfo | null): string {
  if (latestSession === null) {
    return "Listening";
  }
  return latestSession.ended_at === null ? "Active session" : "Listening";
}

/// Derive the connection-level status from session and event counts.
///
/// Pure function: returns "No plugin connected" when no sessions and no events
/// have ever been observed. Otherwise delegates to deriveStatus for session-level
/// status ("Active session" or "Listening").
export function deriveConnectionStatus(
  sessionCount: number,
  eventCount: number,
  latestSession: SessionInfo | null
): string {
  if (sessionCount === 0 && eventCount === 0) {
    return "No plugin connected";
  }
  return deriveStatus(latestSession);
}

/// Determine whether a session is currently active (no ended_at timestamp).
///
/// Pure function: returns true when the session has not ended.
export function isSessionActive(session: SessionInfo): boolean {
  return session.ended_at === null;
}

/// Sort sessions by started_at timestamp, most recent first.
///
/// Pure function: returns a new sorted array without mutating the input.
export function sortSessionsMostRecentFirst(
  sessions: readonly SessionInfo[]
): readonly SessionInfo[] {
  return [...sessions].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

/// Format the duration of a session for display.
///
/// Pure function: returns "Active" for ongoing sessions,
/// or a human-readable duration string for completed sessions.
export function formatSessionDuration(session: SessionInfo): string {
  const seconds = calculateDurationSeconds(session.started_at, session.ended_at);
  if (seconds === null) {
    return "Active";
  }
  return formatDuration(seconds);
}

/// Format the tray tooltip based on active state.
///
/// Pure function: when listening, shows "AppName vVersion".
/// When active, appends status and event count.
export function formatActiveTooltip(
  appName: string,
  version: string,
  status: string,
  eventCount: number
): string {
  const base = `${appName} v${version}`;
  if (status === "Listening") {
    return base;
  }
  return `${base} - ${status} (${eventCount} events)`;
}
