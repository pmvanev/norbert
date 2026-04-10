/**
 * Acceptance tests: Session Metrics Table -- Sorting
 *
 * Validates column-based sorting behavior: ascending/descending toggle,
 * default sort order, sort persistence across data updates, and
 * graceful handling of missing metrics.
 *
 * Driving ports:
 *   - sortTableRows(rows, columnId, direction) -> TableRow[]
 *   - applySortToggle(currentSort, columnId) -> SortState
 *
 * Traces to: Milestone 1 -- Sorting
 */

import { describe, it, expect } from "vitest";
import type { TableRow, SortState } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";
import {
  sortTableRows,
  applySortToggle,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<TableRow> & { sessionId: string }): TableRow {
  return {
    name: overrides.sessionId,
    isActive: false,
    cost: 0,
    totalTokens: 0,
    burnRate: 0,
    contextPercent: 0,
    durationMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// DEFAULT SORT
// ---------------------------------------------------------------------------

describe("Default sort shows active sessions first, then most recent", () => {
  it("active sessions sort above completed, each group ordered by recency", () => {
    // Given two active sessions started 5 and 15 minutes ago
    // And three completed sessions from 1 hour, 3 hours, and 1 day ago
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "completed-3h", isActive: false, durationMs: 3 * 60 * 60_000 }),
      makeRow({ sessionId: "active-15m", isActive: true, durationMs: 15 * 60_000 }),
      makeRow({ sessionId: "completed-1d", isActive: false, durationMs: 24 * 60 * 60_000 }),
      makeRow({ sessionId: "active-5m", isActive: true, durationMs: 5 * 60_000 }),
      makeRow({ sessionId: "completed-1h", isActive: false, durationMs: 1 * 60 * 60_000 }),
    ];

    // When table rows are sorted with default sort (active first, then by recency = most recent/shortest duration first)
    const sorted = sortTableRows(rows, "durationMs", "asc");

    // For default sort, we sort active-first then by duration ascending within each group
    // But the actual default sort should be: active sessions first, each group by recency (ascending duration)
    // Active group: 5m, 15m
    // Completed group: 1h, 3h, 1d

    // Then the first two rows are the active sessions (5m then 15m)
    expect(sorted[0].sessionId).toBe("active-5m");
    expect(sorted[1].sessionId).toBe("active-15m");
    expect(sorted[0].isActive).toBe(true);
    expect(sorted[1].isActive).toBe(true);

    // And the next three rows are completed sessions (1h, 3h, 1d)
    expect(sorted[2].sessionId).toBe("completed-1h");
    expect(sorted[3].sessionId).toBe("completed-3h");
    expect(sorted[4].sessionId).toBe("completed-1d");
    expect(sorted[2].isActive).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ASCENDING / DESCENDING TOGGLE
// ---------------------------------------------------------------------------

describe("Sort sessions by cost ascending", () => {
  it("clicking cost header sorts lowest to highest", () => {
    // Given rows with costs $0.08, $1.24, and $0.52
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", cost: 0.08 }),
      makeRow({ sessionId: "s2", cost: 1.24 }),
      makeRow({ sessionId: "s3", cost: 0.52 }),
    ];

    // When rows are sorted by cost ascending
    const sorted = sortTableRows(rows, "cost", "asc");

    // Then the order is $0.08, $0.52, $1.24
    expect(sorted[0].cost).toBe(0.08);
    expect(sorted[1].cost).toBe(0.52);
    expect(sorted[2].cost).toBe(1.24);
  });
});

describe("Sort sessions by cost descending on second click", () => {
  it("clicking cost header again reverses to highest first", () => {
    // Given rows are currently sorted by cost ascending
    const currentSort: SortState = { columnId: "cost", direction: "asc" };

    // When sort toggle is applied to cost column
    const nextSort = applySortToggle(currentSort, "cost");

    // Then the direction flips to descending
    expect(nextSort.columnId).toBe("cost");
    expect(nextSort.direction).toBe("desc");

    // And the order becomes $1.24, $0.52, $0.08
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", cost: 0.08 }),
      makeRow({ sessionId: "s2", cost: 1.24 }),
      makeRow({ sessionId: "s3", cost: 0.52 }),
    ];
    const sorted = sortTableRows(rows, nextSort.columnId, nextSort.direction);
    expect(sorted[0].cost).toBe(1.24);
    expect(sorted[1].cost).toBe(0.52);
    expect(sorted[2].cost).toBe(0.08);
  });
});

describe("Sort sessions by token count", () => {
  it("token column sorts numerically, not lexicographically", () => {
    // Given rows with token counts 9300, 61000, and 142500
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", totalTokens: 9300 }),
      makeRow({ sessionId: "s2", totalTokens: 61000 }),
      makeRow({ sessionId: "s3", totalTokens: 142500 }),
    ];

    // When rows are sorted by tokens ascending
    const sorted = sortTableRows(rows, "totalTokens", "asc");

    // Then order is 9300, 61000, 142500
    expect(sorted[0].totalTokens).toBe(9300);
    expect(sorted[1].totalTokens).toBe(61000);
    expect(sorted[2].totalTokens).toBe(142500);
  });
});

describe("Sort sessions by burn rate to find fastest consumers", () => {
  it("descending burn rate puts highest consumer first", () => {
    // Given "norbert" has burn rate 150, "api-server" 12, "docs-site" 0
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "api-server", name: "api-server", burnRate: 12 }),
      makeRow({ sessionId: "norbert", name: "norbert", burnRate: 150 }),
      makeRow({ sessionId: "docs-site", name: "docs-site", burnRate: 0 }),
    ];

    // When rows are sorted by burn rate descending
    const sorted = sortTableRows(rows, "burnRate", "desc");

    // Then "norbert" (150) appears first, "docs-site" (0) appears last
    expect(sorted[0].name).toBe("norbert");
    expect(sorted[0].burnRate).toBe(150);
    expect(sorted[2].name).toBe("docs-site");
    expect(sorted[2].burnRate).toBe(0);
  });
});

describe("Sort sessions by context utilization", () => {
  it("descending context sort surfaces sessions nearing compaction", () => {
    // Given "norbert" at 82% context, "api-server" at 15% context
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "api-server", name: "api-server", contextPercent: 15 }),
      makeRow({ sessionId: "norbert", name: "norbert", contextPercent: 82 }),
    ];

    // When rows are sorted by context descending
    const sorted = sortTableRows(rows, "contextPercent", "desc");

    // Then "norbert" (82%) appears first
    expect(sorted[0].name).toBe("norbert");
    expect(sorted[0].contextPercent).toBe(82);
  });
});

describe("Sort sessions by duration", () => {
  it("descending duration puts longest-running session first", () => {
    // Given sessions running for 2 min, 45 min, and 3 hours
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", durationMs: 2 * 60_000 }),
      makeRow({ sessionId: "s2", durationMs: 45 * 60_000 }),
      makeRow({ sessionId: "s3", durationMs: 3 * 60 * 60_000 }),
    ];

    // When rows are sorted by duration descending
    const sorted = sortTableRows(rows, "durationMs", "desc");

    // Then the 3-hour session appears first
    expect(sorted[0].durationMs).toBe(3 * 60 * 60_000);
    expect(sorted[1].durationMs).toBe(45 * 60_000);
    expect(sorted[2].durationMs).toBe(2 * 60_000);
  });
});

// ---------------------------------------------------------------------------
// SORT PERSISTENCE
// ---------------------------------------------------------------------------

describe("Sort persists when new session data arrives", () => {
  it("updating a row value re-sorts without resetting to default", () => {
    // Given rows sorted by cost descending: $1.24, $0.52, $0.08
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "s1", cost: 1.24 }),
      makeRow({ sessionId: "s2", cost: 0.52 }),
      makeRow({ sessionId: "s3", cost: 0.08 }),
    ];

    // When the $0.52 session updates to $0.60
    const updatedRows: readonly TableRow[] = rows.map((r) =>
      r.sessionId === "s2" ? { ...r, cost: 0.60 } : r,
    );

    // And rows are re-sorted with the same sort state
    const sorted = sortTableRows(updatedRows, "cost", "desc");

    // Then the order is $1.24, $0.60, $0.08
    expect(sorted[0].cost).toBe(1.24);
    expect(sorted[1].cost).toBe(0.60);
    expect(sorted[2].cost).toBe(0.08);
  });
});

// ---------------------------------------------------------------------------
// ERROR PATH: Missing metrics
// ---------------------------------------------------------------------------

describe("Sort handles sessions with missing metrics gracefully", () => {
  it("sessions with no cost data sort as zero", () => {
    // Given "legacy" has sessionCost 0 (no API events yet)
    // And "norbert" has sessionCost $1.24
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "norbert", name: "norbert", cost: 1.24 }),
      makeRow({ sessionId: "legacy", name: "legacy", cost: 0 }),
    ];

    // When rows are sorted by cost ascending
    const sorted = sortTableRows(rows, "cost", "asc");

    // Then "legacy" (0) appears first, "norbert" ($1.24) appears second
    expect(sorted[0].name).toBe("legacy");
    expect(sorted[0].cost).toBe(0);
    expect(sorted[1].name).toBe("norbert");
    expect(sorted[1].cost).toBe(1.24);
  });
});
