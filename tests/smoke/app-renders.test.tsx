/**
 * @vitest-environment jsdom
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
    return Promise.reject(new Error(`Unknown command: ${cmd}`));
  });
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();

  // Reset localStorage mock
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

describe("App smoke test — catches black screen regressions", () => {
  it("renders the menu bar with View entry", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("View")).toBeInTheDocument();
    });
  });

  it("renders the status bar footer", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/status/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Port: \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Sessions: \d+/)).toBeInTheDocument();
    expect(screen.getByText(/Events: \d+/)).toBeInTheDocument();
  });

  it("renders session rows when sessions exist", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByRole("button").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("renders a <main> element as the top-level container", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByText("View")).toBeInTheDocument();
    });

    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
  });

  it("shows loading state before data arrives", () => {
    mockedInvoke.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<App />);
    const main = container.querySelector("main");
    expect(main).toBeInTheDocument();
    expect(main?.textContent).toContain("Loading");
  });

  it("shows error state when backend fails", async () => {
    mockedInvoke.mockImplementation(() =>
      Promise.reject(new Error("Connection refused"))
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
    });
  });
});
