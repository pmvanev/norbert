import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  type AppStatus,
  type SessionInfo,
  formatHeader,
  formatField,
  deriveConnectionStatus,
} from "./domain/status";
import { SessionListView } from "./views/SessionListView";
import { EventDetailView } from "./views/EventDetailView";
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
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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

  /// Handler for selecting a session row to view its events.
  const handleSessionSelect = useCallback((sessionId: string) => {
    setSelectedSessionId(sessionId);
  }, []);

  /// Handler for navigating back to the session list.
  const handleBackToSessions = useCallback(() => {
    setSelectedSessionId(null);
  }, []);

  useEffect(() => {
    function pollStatus() {
      invoke<AppStatus>("get_status")
        .then(setStatus)
        .catch((err) => setError(String(err)));

      invoke<SessionInfo[]>("get_sessions")
        .then(setSessions)
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

  /// Derive the latest session from the sessions list for status calculation.
  const latestSession = sessions.length > 0 ? sessions[0] : null;

  const derivedStatus = deriveConnectionStatus(
    status.session_count,
    status.event_count,
    latestSession
  );

  /// Find the selected session object from the sessions list.
  const selectedSession =
    selectedSessionId !== null
      ? sessions.find((s) => s.id === selectedSessionId) ?? null
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
      {selectedSession !== null ? (
        <EventDetailView
          session={selectedSession}
          onBack={handleBackToSessions}
        />
      ) : (
        <SessionListView
          sessions={sessions}
          onSessionSelect={handleSessionSelect}
        />
      )}
      <footer className="status-bar">
        <span>{formatField("Status", derivedStatus)}</span>
        <span>{formatField("Port", status.port)}</span>
        <span>{formatField("Sessions", status.session_count)}</span>
        <span>{formatField("Events", status.event_count)}</span>
      </footer>
    </main>
  );
}

export default App;
