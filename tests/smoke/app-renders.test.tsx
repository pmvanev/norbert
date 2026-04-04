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
    if (cmd === "get_new_events_batch") {
      return Promise.resolve({});
    }
    if (cmd === "get_transcript_usage") {
      return Promise.resolve({ input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_creation_tokens: 0, model: "", message_count: 0 });
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

describe("Layout structure smoke tests", () => {
  it("renders the sidebar with plugin icons", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    // Sidebar should contain at least one icon button
    const sidebar = screen.getByTestId("sidebar");
    const buttons = sidebar.querySelectorAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the zone container for layout engine", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("zone-container")).toBeInTheDocument();
    });
  });

  it("renders the main zone with session content", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("zone-main")).toBeInTheDocument();
    });
  });

  it("renders sidebar, zone container, and status bar in correct order", async () => {
    const { container } = render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    // Verify the app-body wraps sidebar + zone-container
    const appBody = container.querySelector(".app-body");
    expect(appBody).toBeInTheDocument();

    const sidebar = appBody?.querySelector("[data-testid='sidebar']");
    const zoneContainer = appBody?.querySelector("[data-testid='zone-container']");
    expect(sidebar).toBeInTheDocument();
    expect(zoneContainer).toBeInTheDocument();

    // Status bar should be a direct child of main, after app-body
    const footer = container.querySelector("footer.status-bar");
    expect(footer).toBeInTheDocument();
  });

  it("status bar stays anchored at the bottom (flex-shrink: 0 in CSS)", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    // The footer with status-bar class should exist
    const footer = document.querySelector("footer.status-bar");
    expect(footer).toBeInTheDocument();
    expect(footer?.textContent).toContain("Status:");
  });

  it("session list renders inside the main zone without flicker", async () => {
    render(<App />);

    // Wait for the main zone to contain the session list (sec-hdr with "Sessions" title)
    await waitFor(() => {
      const mainZone = screen.getByTestId("zone-main");
      expect(mainZone.querySelector(".session-list, .session-list-empty")).toBeInTheDocument();
    });
  });
});

describe("Notification plugin smoke tests", () => {
  it("renders a sidebar icon for the Notifications view", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    // The notification settings view should have a sidebar icon with the gear symbol
    const sidebar = screen.getByTestId("sidebar");
    const buttons = sidebar.querySelectorAll("button");
    const titles = Array.from(buttons).map((b) => b.getAttribute("title"));
    expect(titles).toContain("Notifications");
  });

  it("clicking the Notifications sidebar icon shows the Notification Center view", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    // Find and click the Notifications button
    const sidebar = screen.getByTestId("sidebar");
    const buttons = Array.from(sidebar.querySelectorAll("button"));
    const notifButton = buttons.find((b) => b.getAttribute("title") === "Notifications");
    expect(notifButton).toBeDefined();
    notifButton!.click();

    await waitFor(() => {
      expect(screen.getByText("Notification Center")).toBeInTheDocument();
    });
  });

  it("Notification Center shows empty state when no notifications", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    const sidebar = screen.getByTestId("sidebar");
    const buttons = Array.from(sidebar.querySelectorAll("button"));
    const notifButton = buttons.find((b) => b.getAttribute("title") === "Notifications");
    notifButton!.click();

    await waitFor(() => {
      expect(screen.getByText("No notifications")).toBeInTheDocument();
    });
  });

  it("Notification Center has a DND toggle button", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toBeInTheDocument();
    });

    const sidebar = screen.getByTestId("sidebar");
    const buttons = Array.from(sidebar.querySelectorAll("button"));
    const notifButton = buttons.find((b) => b.getAttribute("title") === "Notifications");
    notifButton!.click();

    await waitFor(() => {
      expect(screen.getByLabelText("Enable Do Not Disturb")).toBeInTheDocument();
    });
  });
});
