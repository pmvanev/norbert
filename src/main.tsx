import React from "react";
import ReactDOM from "react-dom/client";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { resolveShortcut } from "./domain/keyboardShortcuts";
import "./styles/themes.css";
import "./styles/design-system.css";
import App from "./App";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ color: "#ff4444", padding: 20, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
          {this.state.error.message}
          {"\n\n"}
          {this.state.error.stack}
        </pre>
      );
    }
    return this.props.children;
  }
}

/// Zoom step size (10% increments).
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_DEFAULT = 1.0;
const ZOOM_STORAGE_KEY = "norbert-zoom";

function readStoredZoom(): number {
  const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
  if (stored !== null) {
    const parsed = parseFloat(stored);
    if (!isNaN(parsed) && parsed >= ZOOM_MIN && parsed <= ZOOM_MAX) {
      return parsed;
    }
  }
  return ZOOM_DEFAULT;
}

function applyZoom(level: number): void {
  document.documentElement.style.zoom = String(level);
  localStorage.setItem(ZOOM_STORAGE_KEY, String(level));
}

let currentZoom = readStoredZoom();
applyZoom(currentZoom);

document.addEventListener("keydown", (e) => {
  const action = resolveShortcut({
    ctrlOrMeta: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    key: e.key,
  });
  if (action === null) return;

  e.preventDefault();
  switch (action) {
    case "new-window":   emit("request-new-window"); break;
    case "close-window": getCurrentWindow().close();  break;
    case "quit-all":     emit("request-quit");        break;
    case "zoom-in":
      currentZoom = Math.min(ZOOM_MAX, currentZoom + ZOOM_STEP);
      applyZoom(currentZoom);
      break;
    case "zoom-out":
      currentZoom = Math.max(ZOOM_MIN, currentZoom - ZOOM_STEP);
      applyZoom(currentZoom);
      break;
    case "zoom-reset":
      currentZoom = ZOOM_DEFAULT;
      applyZoom(currentZoom);
      break;
  }
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
