import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AppStatus,
  type SessionInfo,
  formatHeader,
  formatField,
  isEmptyState,
  EMPTY_STATE_MESSAGE,
  formatDuration,
  calculateDurationSeconds,
  formatSessionTimestamp,
  deriveStatus,
  shouldShowRestartBanner,
} from "./domain/status";

/// Polling interval in milliseconds for live UI updates.
const POLL_INTERVAL_MS = 1000;

function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [latestSession, setLatestSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bannerWasShown, setBannerWasShown] = useState(true);

  useEffect(() => {
    function pollStatus() {
      invoke<AppStatus>("get_status")
        .then(setStatus)
        .catch((err) => setError(String(err)));

      invoke<SessionInfo | null>("get_latest_session")
        .then(setLatestSession)
        .catch((err) => setError(String(err)));
    }

    pollStatus();
    const intervalId = setInterval(pollStatus, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  // Track whether banner should auto-dismiss based on event arrival.
  useEffect(() => {
    if (status && status.event_count > 0 && bannerWasShown) {
      setBannerWasShown(false);
    }
  }, [status, bannerWasShown]);

  if (error) {
    return (
      <main>
        <p>Failed to load status: {error}</p>
      </main>
    );
  }

  if (!status) {
    return (
      <main>
        <p>Loading...</p>
      </main>
    );
  }

  const derivedStatus = deriveStatus(latestSession);
  const showBanner = shouldShowRestartBanner(bannerWasShown, status.event_count);

  const durationSeconds = latestSession
    ? calculateDurationSeconds(latestSession.started_at, latestSession.ended_at)
    : null;

  return (
    <main>
      <h1>{formatHeader("Norbert", status.version)}</h1>
      <p>{formatField("Status", derivedStatus)}</p>
      <p>{formatField("Port", status.port)}</p>
      <p>{formatField("Sessions", status.session_count)}</p>
      <p>{formatField("Events", status.event_count)}</p>
      {showBanner && (
        <p>Restart Claude Code to activate hooks.</p>
      )}
      {isEmptyState(status.session_count) && !showBanner && (
        <p>{EMPTY_STATE_MESSAGE}</p>
      )}
      {latestSession && (
        <section>
          <h2>Last Session</h2>
          <p>{formatField("Started", formatSessionTimestamp(latestSession.started_at))}</p>
          {durationSeconds !== null && (
            <p>{formatField("Duration", formatDuration(durationSeconds))}</p>
          )}
          <p>{formatField("Events", latestSession.event_count)}</p>
        </section>
      )}
    </main>
  );
}

export default App;
