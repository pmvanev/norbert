/// OTel session detection: pure functions to determine if a session
/// is receiving data via OpenTelemetry (api_request events) rather than
/// transcript polling.
///
/// Pure domain logic -- no IO imports, no side effects.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal event shape needed for OTel detection. */
export interface SessionEvent {
  readonly event_type: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The event type that indicates OTel-sourced data. */
export const OTEL_EVENT_TYPE = "api_request";

/**
 * Determine whether a session is OTel-active based on its events.
 *
 * A session is OTel-active if it has received at least one api_request event.
 * OTel-active sessions should skip transcript polling because their usage
 * data arrives directly via the OTel pipeline.
 *
 * Pure function: (events) => boolean
 */
export const isOtelActiveSession = (
  events: ReadonlyArray<SessionEvent>,
): boolean => events.some((event) => event.event_type === OTEL_EVENT_TYPE);
