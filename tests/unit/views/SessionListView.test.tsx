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

  it("renders grouped sections with Active and Past headers", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Should show group headers for Active and Past
    expect(screen.getByText(/Active Sessions/)).toBeInTheDocument();
    expect(screen.getByText(/Past Sessions/)).toBeInTheDocument();
  });

  it("renders group total rows with cost and token aggregates", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Should render total rows within the table (one per group with rows)
    const totalRows = document.querySelectorAll(".group-total");
    expect(totalRows.length).toBeGreaterThan(0);
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

  it("preserves the sec-hdr title area", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    expect(screen.getByText("Sessions")).toBeInTheDocument();
  });

  it("renders time-range pills in the Past Sessions header", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Should render pill buttons for time ranges
    expect(screen.getByRole("button", { name: "15m" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1h" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "24h" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
  });

  it("group total row hides when group is collapsed", async () => {
    render(
      <SessionListView sessions={twoSessions} onSessionSelect={vi.fn()} />,
    );

    // Before collapse: total row(s) visible
    const totalsBefore = document.querySelectorAll(".group-total");
    const countBefore = totalsBefore.length;
    expect(countBefore).toBeGreaterThan(0);

    // Collapse the Active Sessions group by clicking its header
    const activeHeader = screen.getByText(/Active Sessions/);
    fireEvent.click(activeHeader);

    // After collapse: one fewer total row
    const totalsAfter = document.querySelectorAll(".group-total");
    expect(totalsAfter.length).toBe(countBefore - 1);
  });

  it("renders empty state when no sessions exist", async () => {
    render(
      <SessionListView sessions={[]} onSessionSelect={vi.fn()} />,
    );

    // Should show empty state, not a table
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
