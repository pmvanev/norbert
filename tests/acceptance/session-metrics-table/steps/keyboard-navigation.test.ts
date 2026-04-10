/**
 * Acceptance tests: Session Metrics Table -- Keyboard Navigation
 *
 * Validates keyboard-based row navigation: arrow keys to move focus,
 * Enter to select, and boundary behavior at first/last rows.
 *
 * Driving ports:
 *   - moveFocus(currentIndex, direction, rowCount) -> number
 *   - selectFocusedRow(focusedIndex, rows) -> string | null (sessionId)
 *
 * Traces to: Milestone 6 -- Keyboard Navigation
 */

import { describe, it, expect } from "vitest";
import {
  moveFocus,
  selectFocusedRow,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";
import type { TableRow } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";

// ---------------------------------------------------------------------------
// Test helper: minimal row fixtures
// ---------------------------------------------------------------------------

function makeRow(sessionId: string): TableRow {
  return {
    sessionId,
    name: "test",
    isActive: true,
    cost: 0,
    totalTokens: 0,
    burnRate: 0,
    contextPercent: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    activeAgents: 0,
    totalEventCount: 0,
    version: null,
    platform: null,
  };
}

// ---------------------------------------------------------------------------
// ARROW KEY NAVIGATION
// ---------------------------------------------------------------------------

describe("Arrow down moves selection to next row", () => {
  it("focus index increments by one", () => {
    // Given current focus index is 0 and row count is 5
    // When moveFocus is called with direction "down"
    const result = moveFocus(0, "down", 5);

    // Then the new focus index is 1
    expect(result).toBe(1);
  });
});

describe("Arrow up moves selection to previous row", () => {
  it("focus index decrements by one", () => {
    // Given current focus index is 2 and row count is 5
    // When moveFocus is called with direction "up"
    const result = moveFocus(2, "up", 5);

    // Then the new focus index is 1
    expect(result).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ENTER KEY SELECTION
// ---------------------------------------------------------------------------

describe("Enter key opens session detail panel", () => {
  it("selecting focused row returns the session ID", () => {
    // Given rows with IDs ["abc-1", "def-2", "ghi-3"]
    const rows: readonly TableRow[] = [
      makeRow("abc-1"),
      makeRow("def-2"),
      makeRow("ghi-3"),
    ];

    // And focus index is 0
    // When selectFocusedRow is called
    const result = selectFocusedRow(0, rows);

    // Then the result is "abc-1"
    expect(result).toBe("abc-1");
  });
});

// ---------------------------------------------------------------------------
// BOUNDARY BEHAVIOR
// ---------------------------------------------------------------------------

describe("Arrow down at last row stays on last row", () => {
  it("focus index clamps at row count minus one", () => {
    // Given current focus index is 4 and row count is 5
    // When moveFocus is called with direction "down"
    const result = moveFocus(4, "down", 5);

    // Then the new focus index is 4 (unchanged)
    expect(result).toBe(4);
  });
});

describe("Arrow up at first row stays on first row", () => {
  it("focus index clamps at zero", () => {
    // Given current focus index is 0 and row count is 5
    // When moveFocus is called with direction "up"
    const result = moveFocus(0, "up", 5);

    // Then the new focus index is 0 (unchanged)
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// ERROR PATH: Empty table
// ---------------------------------------------------------------------------

describe("Keyboard navigation with zero sessions", () => {
  it("moveFocus with zero rows returns -1 (no valid index)", () => {
    // Given row count is 0
    // When moveFocus is called with direction "down"
    const result = moveFocus(0, "down", 0);

    // Then the result is -1
    expect(result).toBe(-1);
  });
});
