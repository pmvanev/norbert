import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type SessionInfo,
  isSessionActive,
  formatSessionTimestamp,
  formatSessionDuration,
} from "../domain/status";
import {
  type SessionEvent,
  formatEventTimestamp,
  formatEventLabel,
  formatPayloadSnippet,
} from "../domain/eventDetail";
import {
  deriveStatusLabel,
  deriveStatusClass,
} from "../domain/sessionPresentation";

/// Props for the EventDetailView component.
interface EventDetailViewProps {
  readonly session: SessionInfo;
  readonly onBack: () => void;
}

/// Maximum character length for payload snippets in the event list.
const PAYLOAD_SNIPPET_MAX_LENGTH = 80;

/// Polling interval in milliseconds for live event updates.
const EVENT_POLL_INTERVAL_MS = 1000;

/// A single event row displaying timestamp, canonical type label, and payload snippet.
function EventRow({ event }: { readonly event: SessionEvent }) {
  return (
    <div className="event-row">
      <span className="event-time mono">
        {formatEventTimestamp(event.received_at)}
      </span>
      <span className="event-type">{formatEventLabel(event)}</span>
      <span className="event-payload mono">
        {formatPayloadSnippet(event.payload, PAYLOAD_SNIPPET_MAX_LENGTH)}
      </span>
    </div>
  );
}

/// Displays the event detail view for a selected session.
///
/// Shows a fixed session header with start time, duration, event count, and status.
/// Below the header, events are listed chronologically with timestamp, type, and payload.
/// Back navigation returns to the session list.
export function EventDetailView({ session, onBack }: EventDetailViewProps) {
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function fetchEvents() {
      invoke<SessionEvent[]>("get_session_events", {
        sessionId: session.id,
      })
        .then((data) => {
          if (!cancelled) {
            setEvents(data);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Failed to load events");
          }
        });
    }

    fetchEvents();
    const intervalId = setInterval(fetchEvents, EVENT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [session.id]);

  const active = isSessionActive(session);
  const statusLabel = deriveStatusLabel(active);
  const statusClass = deriveStatusClass(active);

  return (
    <section className="event-detail">
      <div className="event-detail-header">
        <button className="back-button" onClick={onBack} aria-label="Back to Sessions">
          &larr; Back to Sessions
        </button>
        <div className="session-header-info">
          <span className="session-header-field">
            <span className="session-header-label">Start</span>
            <span className="session-header-value mono">
              {formatSessionTimestamp(session.started_at)}
            </span>
          </span>
          <span className="session-header-field">
            <span className="session-header-label">Duration</span>
            <span className="session-header-value mono">
              {formatSessionDuration(session)}
            </span>
          </span>
          <span className="session-header-field">
            <span className="session-header-label">Events</span>
            <span className="session-header-value mono">
              {session.event_count}
            </span>
          </span>
          <span className="session-header-field">
            <span className="session-header-label">Status</span>
            <span className={`session-header-value mono ${statusClass}`}>
              {statusLabel}
            </span>
          </span>
        </div>
      </div>
      {error !== null && (
        <div className="event-error" role="alert">{error}</div>
      )}
      <div className="event-list">
        {/* TODO: A proper event ID from the backend would produce stable keys */}
        {events.map((event, index) => (
          <EventRow key={`${event.received_at}-${event.event_type}-${index}`} event={event} />
        ))}
      </div>
    </section>
  );
}
