/// Session time-window filter — pure domain module.
///
/// Provides predicate-based filtering of sessions by recency.
/// All functions are pure: `now` is injected, no Date.now() calls.

import { isSessionActive, type SessionInfo } from "./status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Discriminated union of all supported filter identifiers.
export type SessionFilterId =
  | "active-now"
  | "last-15m"
  | "last-1h"
  | "last-24h"
  | "all";

/// A named filter preset with its predicate function.
export interface SessionFilterPreset {
  readonly id: SessionFilterId;
  readonly label: string;
  readonly predicate: (session: SessionInfo, now: number) => boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Check whether a session's last_event_at falls within a time window.
///
/// Pure function: returns false when last_event_at is null.
const isWithinWindow = (
  session: SessionInfo,
  windowMs: number,
  now: number,
): boolean => {
  if (session.last_event_at === null) return false;
  const lastEventTime = new Date(session.last_event_at).getTime();
  return now - lastEventTime <= windowMs;
};

// ---------------------------------------------------------------------------
// Time constants
// ---------------------------------------------------------------------------

const MINUTES_15 = 15 * 60 * 1000;
const HOURS_1 = 60 * 60 * 1000;
const HOURS_24 = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/// All available filter presets, ordered for display.
export const SESSION_FILTER_PRESETS: readonly SessionFilterPreset[] = [
  {
    id: "active-now",
    label: "Active Now",
    predicate: (session, now) => isSessionActive(session, now),
  },
  {
    id: "last-15m",
    label: "Last 15 minutes",
    predicate: (session, now) => isWithinWindow(session, MINUTES_15, now),
  },
  {
    id: "last-1h",
    label: "Last hour",
    predicate: (session, now) => isWithinWindow(session, HOURS_1, now),
  },
  {
    id: "last-24h",
    label: "Last 24 hours",
    predicate: (session, now) => isWithinWindow(session, HOURS_24, now),
  },
  {
    id: "all",
    label: "All sessions",
    predicate: () => true,
  },
] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Filter sessions by a named filter preset.
///
/// Pure function: deterministic given the same sessions, filterId, and now.
export function filterSessions(
  sessions: readonly SessionInfo[],
  filterId: SessionFilterId,
  now: number,
): readonly SessionInfo[] {
  const preset = SESSION_FILTER_PRESETS.find((p) => p.id === filterId);
  if (preset === undefined) return sessions;
  return sessions.filter((session) => preset.predicate(session, now));
}
