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

/// Format the application header from name and version.
///
/// Pure function: no side effects.
export function formatHeader(appName: string, version: string): string {
  return `${appName.toUpperCase()} v${version}`;
}

/// Message displayed when no sessions have been observed yet.
export const EMPTY_STATE_MESSAGE =
  "Waiting for first Claude Code session...";

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
