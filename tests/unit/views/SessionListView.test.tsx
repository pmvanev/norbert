/**
 * @vitest-environment jsdom
 */
/**
 * Integration tests: SessionListView metrics table wiring (Step 03-01)
 *
 * Verifies that SessionListView renders a table layout with:
 * - Sortable column headers
 * - Grouped sections (Active / Recent)
 * - Status bar with aggregate totals
 * - Keyboard navigation (arrow keys + Enter)
 *
 * Domain functions are already fully tested; these tests verify
 * the view correctly wires domain outputs to the DOM.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SessionInfo } from "../../../src/domain/status";

// Mock Tauri invoke before importing the component
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockedInvoke = vi.mocked(invoke);

// Must import after mock setup
import { SessionListView } from "../../../src/views/SessionListView";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const NOW = new Date("2026-04-10T12:00:00Z").getTime();

/** Active session: no ended_at, recent last_event_at */
const activeSession: SessionInfo = {
  id: "session-active-1",
  started_at: "2026-04-10T11:30:00Z",
  ended_at: null,
  event_count: 42,
  last_event_at: "2026-04-10T11:59:50Z",
};

/** Recent (completed) session */
const recentSession: SessionInfo = {
  id: "session-recent-1",
  started_at: "2026-04-10T10:00:00Z",
  ended_at: "2026-04-10T10:45:00Z",
  event_count: 100,
  last_event_at: "2026-04-10T10:44:00Z",
};

const twoSessions: readonly SessionInfo[] = [activeSession, recentSession];

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);

  // Default: invoke returns empty arrays for metadata
  mockedInvoke.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Acceptance tests
// ---------------------------------------------------------------------------

describe("SessionListView metrics table", () => {
  it("renders a table with column headers when sessions are provided", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Should render a table element
    const table = screen.getByRole("table");
    expect(table).toBeInTheDocument();

    // Should have sortable column headers (some may include sort indicator)
    const columnHeaders = within(table).getAllByRole("columnheader");
    const headerTexts = columnHeaders.map((h) => h.textContent ?? "");
    expect(headerTexts.some((t) => t.includes("Name"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("Cost"))).toBe(true);
    expect(headerTexts.some((t) => t.includes("Tokens"))).toBe(true);
  });

  it("renders grouped sections with Active and Recent headers", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Should show group headers for Active and Recent
    expect(screen.getByText(/Active Sessions/)).toBeInTheDocument();
    expect(screen.getByText(/Recent Sessions/)).toBeInTheDocument();
  });

  it("renders a status bar with aggregate totals", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Status bar should show session count (default filter "active-now" shows 1 active)
    const statusBar = screen.getByTestId("status-bar");
    expect(statusBar).toBeInTheDocument();
    expect(statusBar.textContent).toMatch(/\d+ sessions/);
  });

  it("selects a row when Enter is pressed on a focused row", async () => {
    const onSelect = vi.fn();
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={onSelect} />,
    );

    const table = screen.getByRole("table");
    // Focus the table and press arrow down then Enter
    fireEvent.keyDown(table, { key: "ArrowDown" });
    fireEvent.keyDown(table, { key: "Enter" });

    expect(onSelect).toHaveBeenCalled();
  });

  it("preserves the sec-hdr title area with filter dropdown", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument(); // select dropdown
  });

  it("renders empty state when no sessions exist", async () => {
    render(
      <SessionListView sessions={[]} onSessionSelect={vi.fn()} />,
    );

    // Should show empty state, not a table
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
