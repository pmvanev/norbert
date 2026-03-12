import {
  type SessionInfo,
  isSessionActive,
  sortSessionsMostRecentFirst,
  formatSessionDuration,
  formatSessionTimestamp,
  isEmptyState,
  EMPTY_STATE_MESSAGE,
  PLUGIN_INSTALL_COMMAND,
} from "../domain/status";

/// Props for the SessionListView component.
interface SessionListViewProps {
  readonly sessions: readonly SessionInfo[];
}

/// A single session row with glassmorphism card styling.
///
/// Active sessions show a pulsing green dot; completed sessions show a dim dot.
function SessionRow({ session }: { readonly session: SessionInfo }) {
  const active = isSessionActive(session);
  const rowClassName = `srow${active ? " live-s" : ""}`;
  const dotClassName = `sdot${active ? " live" : " done"}`;

  return (
    <div className={rowClassName}>
      <span className={dotClassName} />
      <span className="sname">{formatSessionTimestamp(session.started_at)}</span>
      <span className="sbadge br">{formatSessionDuration(session)}</span>
      <span className="sbadge br">{session.event_count} events</span>
    </div>
  );
}

/// Displays a list of sessions ordered most-recent-first.
///
/// Shows an empty state message when no sessions exist.
/// Each row displays start timestamp, duration, and event count.
export function SessionListView({ sessions }: SessionListViewProps) {
  if (isEmptyState(sessions.length)) {
    return (
      <section className="session-list-empty">
        <p>{EMPTY_STATE_MESSAGE}</p>
        <code>{PLUGIN_INSTALL_COMMAND}</code>
      </section>
    );
  }

  const sortedSessions = sortSessionsMostRecentFirst(sessions);

  return (
    <section className="session-list">
      {sortedSessions.map((session) => (
        <SessionRow key={session.id} session={session} />
      ))}
    </section>
  );
}
