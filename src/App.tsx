import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type AppStatus, formatHeader, formatField } from "./domain/status";

function App() {
  const [status, setStatus] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<AppStatus>("get_status")
      .then(setStatus)
      .catch((err) => setError(String(err)));
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

  return (
    <main>
      <h1>{formatHeader("Norbert", status.version)}</h1>
      <p>{formatField("Status", status.status)}</p>
      <p>{formatField("Port", status.port)}</p>
      <p>{formatField("Sessions", status.session_count)}</p>
      <p>{formatField("Events", status.event_count)}</p>
      {status.session_count === 0 && (
        <p>Waiting for first Claude Code session...</p>
      )}
    </main>
  );
}

export default App;
