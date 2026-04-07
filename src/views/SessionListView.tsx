import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import {
  deriveSessionName,
  deriveSessionRowClass,
  deriveSessionDotClass,
  mapTerminalType,
  formatClaudeVersion,
  formatPlatform,
} from "../domain/sessionPresentation";
import {
  filterSessions,
  SESSION_FILTER_PRESETS,
  type SessionFilterId,
} from "../domain/sessionFilter";

/// Session metadata returned from the Tauri backend.
/// Fields are nullable because metadata may not be available for all sessions.
export interface SessionMetadata {
  readonly session_id: string;
  readonly terminal_type: string | null;
  readonly service_version: string | null;
  readonly os_type: string | null;
  readonly host_arch: string | null;
  readonly cwd: string | null;
}

/// Props for the SessionListView component.
interface SessionListViewProps {
  readonly sessions: readonly SessionInfo[];
  readonly onSessionSelect?: (sessionId: string) => void;
}

/// A single session row with glassmorphism card styling.
///
/// Active sessions show a pulsing green dot; completed sessions show a dim dot.
/// Enrichment badges (IDE, version, platform) display when metadata is available.
/// Clicking a row triggers the onSessionSelect callback.
function SessionRow({
  session,
  metadata,
  onSelect,
}: {
  readonly session: SessionInfo;
  readonly metadata: SessionMetadata | undefined;
  readonly onSelect?: (sessionId: string) => void;
}) {
  const active = isSessionActive(session);
  const rowClassName = deriveSessionRowClass(active);
  const dotClassName = deriveSessionDotClass(active);

  const ideBadge = mapTerminalType(metadata?.terminal_type ?? null);
  const versionBadge = formatClaudeVersion(metadata?.service_version ?? null);
  const platformBadge = formatPlatform(
    metadata?.os_type ?? null,
    metadata?.host_arch ?? null,
  );

  const handleClick = () => {
    onSelect?.(session.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect?.(session.id);
    }
  };

  return (
    <div className={rowClassName} onClick={handleClick} onKeyDown={handleKeyDown} role="button" tabIndex={0}>
      <span className={dotClassName} />
      <span className="sname" title={metadata?.cwd ?? undefined}>
        {deriveSessionName(metadata?.cwd ?? null, formatSessionTimestamp(session.started_at))}
      </span>
      {ideBadge !== null && <span className="sbadge br">{ideBadge}</span>}
      {versionBadge !== null && <span className="sbadge br">{versionBadge}</span>}
      {platformBadge !== null && <span className="sbadge br">{platformBadge}</span>}
      <span className="sbadge br">{formatSessionDuration(session)}</span>
      <span className="sbadge br">{session.event_count} events</span>
    </div>
  );
}

/// Displays a list of sessions ordered most-recent-first.
///
/// Shows an empty state message when no sessions exist.
/// Each row displays start timestamp, duration, and event count.
export function SessionListView({ sessions, onSessionSelect }: SessionListViewProps) {
  const [metadataMap, setMetadataMap] = useState<ReadonlyMap<string, SessionMetadata>>(new Map());
  const [selectedFilter, setSelectedFilter] = useState<SessionFilterId>("active-now");

  /// Fetch session metadata once when sessions change.
  /// Builds a lookup map keyed by session_id for O(1) access per row.
  useEffect(() => {
    if (sessions.length === 0) return;
    invoke<SessionMetadata[]>("get_all_session_metadata")
      .then((metadataList) => {
        const map = new Map<string, SessionMetadata>();
        for (const meta of metadataList) {
          map.set(meta.session_id, meta);
        }
        setMetadataMap(map);
      })
      .catch(() => {
        // Missing metadata is not an error — badges simply won't display
      });
  }, [sessions]);

  const filteredSessions = useMemo(
    () => filterSessions(sessions, selectedFilter, Date.now()),
    [sessions, selectedFilter],
  );
  const sortedSessions = useMemo(
    () => sortSessionsMostRecentFirst(filteredSessions),
    [filteredSessions],
  );

  if (isEmptyState(sessions.length)) {
    return (
      <section className="session-list-empty">
        <p>{EMPTY_STATE_MESSAGE}</p>
        <code>{PLUGIN_INSTALL_COMMAND}</code>
      </section>
    );
  }

  return (
    <section className="session-list">
      <div className="sec-hdr">
        <span className="sec-t">Sessions</span>
        <select
          className="glass-dropdown"
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value as SessionFilterId)}
        >
          {SESSION_FILTER_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
        <span className="sec-a">{filteredSessions.length} sessions</span>
      </div>
      {sortedSessions.length === 0 ? (
        <p className="session-filter-empty">No sessions in this time window</p>
      ) : (
        sortedSessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            metadata={metadataMap.get(session.id)}
            onSelect={onSessionSelect}
          />
        ))
      )}
    </section>
  );
}
