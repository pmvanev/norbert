/**
 * @vitest-environment jsdom
 */
/**
 * Unit tests: App.tsx plugin + layout engine integration (Step 05-03)
 *
 * Validates that App.tsx:
 * 1. Initializes the plugin system (loads norbert-session plugin)
 * 2. Renders the ZoneRenderer instead of hardcoded views
 * 3. Builds a view registry mapping viewIds to React components
 * 4. Keeps status bar footer (theme menu is now native Tauri menu)
 * 5. Session list functionality remains accessible through the layout engine
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { invoke } from "@tauri-apps/api/core";

// Mock @tauri-apps/api/core before importing App
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock @tauri-apps/api/event (listen returns an unlisten function)
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

const mockedInvoke = vi.mocked(invoke);

// Must import App after mock setup
import App from "../../src/App";

function setupDefaultMocks() {
  mockedInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_status") {
      return Promise.resolve({
        version: "0.2.1-test",
        port: 3001,
        session_count: 2,
        event_count: 10,
      });
    }
    if (cmd === "get_sessions") {
      return Promise.resolve([
        {
          id: "session-1",
          started_at: "2026-03-12T10:00:00Z",
          last_event_at: "2026-03-12T10:05:00Z",
          event_count: 5,
        },
        {
          id: "session-2",
          started_at: "2026-03-12T09:00:00Z",
          last_event_at: "2026-03-12T09:30:00Z",
          event_count: 5,
        },
      ]);
    }
    if (cmd === "get_status_and_sessions") {
      return Promise.resolve([
        { version: "0.2.1-test", port: 3001, session_count: 2, event_count: 10 },
        [
          { id: "session-1", started_at: "2026-03-12T10:00:00Z", last_event_at: "2026-03-12T10:05:00Z", event_count: 5 },
          { id: "session-2", started_at: "2026-03-12T09:00:00Z", last_event_at: "2026-03-12T09:30:00Z", event_count: 5 },
        ],
      ]);
    }
    if (cmd === "get_new_events_batch") {
      return Promise.resolve({});
    }
    if (cmd === "get_transcript_usage") {
      return Promise.resolve({ input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, model: "", message_count: 0 });
    }
    if (cmd === "sync_theme_menu") {
      return Promise.resolve();
    }
    return Promise.reject(new Error(`Unknown command: ${cmd}`));
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();

  const store: Record<string, string> = {};
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => Object.keys(store).forEach((k) => delete store[k]),
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  });
});

// ---------------------------------------------------------------------------
// App renders through layout engine, not hardcoded views
// ---------------------------------------------------------------------------

describe("App renders via plugin system and layout engine", () => {
  it("renders the ZoneRenderer container instead of hardcoded views", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      // ZoneRenderer renders a zone-container div
      const zoneContainer = container.querySelector("[data-testid='zone-container']");
      expect(zoneContainer).toBeInTheDocument();
    });
  });

  it("renders session list inside the main zone via view registry", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      // Session rows should still be rendered (via the plugin view registry)
      const zoneMain = container.querySelector("[data-testid='zone-main']");
      expect(zoneMain).toBeInTheDocument();
    });
  });

  it("syncs theme to native menu on mount", async () => {
    render(<App />);

    await waitFor(() => {
      expect(mockedInvoke).toHaveBeenCalledWith("sync_theme_menu", { theme: "nb" });
    });
  });

  it("preserves the status bar footer with live metrics", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Status:/)).toBeInTheDocument();
    });

    expect(screen.getByText(/Port: \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Sessions: \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Events: \d+/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// App.tsx delegates view rendering to Layout Engine (no inline view JSX)
// ---------------------------------------------------------------------------

describe("App.tsx delegates view rendering to Layout Engine", () => {
  it("does not render SessionListView or EventDetailView directly in JSX", async () => {
    const fs = await import("fs");
    const appSource = fs.readFileSync("src/App.tsx", "utf-8");

    // App.tsx should NOT have <SessionListView or <EventDetailView in its JSX return.
    // These views are rendered through the ZoneRenderer via the view registry.
    // The regex matches JSX usage like <SessionListView or <EventDetailView
    // but NOT import statements or variable references.
    const jsxSessionList = appSource.match(/<SessionListView[\s/>]/);
    const jsxEventDetail = appSource.match(/<EventDetailView[\s/>]/);

    // Only wrapper/factory definitions are allowed (inside useMemo etc.)
    // The main JSX return of App should use <ZoneRenderer instead
    expect(appSource).toContain("<ZoneRenderer");

    // The JSX in the return statement should not directly render view components
    // We verify this by checking that the return JSX block uses ZoneRenderer
    const returnBlock = appSource.slice(appSource.lastIndexOf("return ("));
    expect(returnBlock).toContain("ZoneRenderer");
    expect(returnBlock).not.toContain("<SessionListView");
    expect(returnBlock).not.toContain("<EventDetailView");
  });
});
