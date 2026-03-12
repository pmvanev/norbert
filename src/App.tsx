import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AppStatus,
  type SessionInfo,
  formatHeader,
  formatField,
  isEmptyState,
  EMPTY_STATE_MESSAGE,
  PLUGIN_INSTALL_COMMAND,
  formatDuration,
  calculateDurationSeconds,
  formatSessionTimestamp,
  deriveConnectionStatus,
} from "./domain/status";
import {
  type ThemeName,
  THEME_NAMES,
  THEME_LABELS,
  readStoredTheme,
  storeTheme,
  themeToClassName,
} from "./domain/theme";

/// Polling interval in milliseconds for live UI updates.
const POLL_INTERVAL_MS = 1000;

/// Applies a theme CSS class to the document root element.
/// Removes all other theme classes first to ensure clean switching.
const applyThemeToDocument = (theme: ThemeName): void => {
  const root = document.documentElement;
  for (const name of THEME_NAMES) {
    root.classList.remove(themeToClassName(name));
  }
  root.classList.add(themeToClassName(theme));
};

function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [latestSession, setLatestSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>(() =>
    readStoredTheme(localStorage)
  );

  /// Apply theme class to document on mount and theme change.
  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const handleThemeChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newTheme = event.target.value as ThemeName;
      setTheme(newTheme);
      storeTheme(newTheme, localStorage);
    },
    []
  );

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

  const derivedStatus = deriveConnectionStatus(
    status.session_count,
    status.event_count,
    latestSession
  );

  const durationSeconds = latestSession
    ? calculateDurationSeconds(latestSession.started_at, latestSession.ended_at)
    : null;

  return (
    <main>
      <h1>{formatHeader("Norbert", status.version)}</h1>
      <div className="theme-switcher">
        <span className="theme-switcher-label">Theme</span>
        <select
          className="theme-switcher-select"
          value={theme}
          onChange={handleThemeChange}
          aria-label="Select theme"
        >
          {THEME_NAMES.map((name) => (
            <option key={name} value={name}>
              {THEME_LABELS[name]}
            </option>
          ))}
        </select>
      </div>
      <p>{formatField("Status", derivedStatus)}</p>
      <p>{formatField("Port", status.port)}</p>
      <p>{formatField("Sessions", status.session_count)}</p>
      <p>{formatField("Events", status.event_count)}</p>
      {isEmptyState(status.session_count) && (
        <section>
          <p>{EMPTY_STATE_MESSAGE}</p>
          <code>{PLUGIN_INSTALL_COMMAND}</code>
        </section>
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
