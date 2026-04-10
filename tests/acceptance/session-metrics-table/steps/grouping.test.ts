/**
 * Acceptance tests: Session Metrics Table -- Row Grouping
 *
 * Validates that sessions are grouped under "Active Sessions" and
 * "Recent Sessions" expandable headers based on activity status.
 *
 * Driving ports:
 *   - groupSessionRows(rows, now) -> GroupedRows
 *   - toggleGroupCollapsed(collapsed) -> boolean
 *
 * Traces to: Milestone 3 -- Grouping
 */

import { describe, it, expect } from "vitest";
import {
  groupSessionRows,
  toggleGroupCollapsed,
} from "../../../../src/plugins/norbert-session/domain/sessionMetricsTable";
import type { TableRow } from "../../../../src/plugins/norbert-session/domain/sessionMetricsTableTypes";

// ---------------------------------------------------------------------------
// Test helpers -- build minimal TableRow fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<TableRow> & { sessionId: string }): TableRow {
  return {
    name: overrides.name ?? overrides.sessionId,
    isActive: overrides.isActive ?? false,
    cost: overrides.cost ?? 0,
    totalTokens: overrides.totalTokens ?? 0,
    burnRate: overrides.burnRate ?? 0,
    contextPercent: overrides.contextPercent ?? 0,
    durationMs: overrides.durationMs ?? 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    activeAgents: 0,
    totalEventCount: 0,
    version: null,
    platform: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// BASIC GROUPING
// ---------------------------------------------------------------------------

describe("Sessions grouped under Active and Recent headers", () => {
  it("active sessions grouped separately from completed sessions", () => {
    // Given two sessions are active and three are completed
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "a1", isActive: true }),
      makeRow({ sessionId: "a2", isActive: true }),
      makeRow({ sessionId: "r1", isActive: false }),
      makeRow({ sessionId: "r2", isActive: false }),
      makeRow({ sessionId: "r3", isActive: false }),
    ];

    // When rows are grouped
    const grouped = groupSessionRows(rows);

    // Then the active group contains 2 rows
    expect(grouped.active).toHaveLength(2);
    // And the recent group contains 3 rows
    expect(grouped.recent).toHaveLength(3);
    // And every active row is actually active
    expect(grouped.active.every((r) => r.isActive)).toBe(true);
    // And every recent row is not active
    expect(grouped.recent.every((r) => !r.isActive)).toBe(true);
  });
});

describe("Active group header shows count of active sessions", () => {
  it("group header includes the count of sessions in the group", () => {
    // Given four sessions are currently active
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "a1", isActive: true }),
      makeRow({ sessionId: "a2", isActive: true }),
      makeRow({ sessionId: "a3", isActive: true }),
      makeRow({ sessionId: "a4", isActive: true }),
    ];

    // When rows are grouped
    const grouped = groupSessionRows(rows);

    // Then the active group count is 4
    expect(grouped.activeCount).toBe(4);
    expect(grouped.recentCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// COLLAPSE / EXPAND
// ---------------------------------------------------------------------------

describe("User collapses and expands session groups", () => {
  it("toggling group collapsed state hides/shows rows", () => {
    // Given group collapsed state starts as expanded (false)
    const expanded = false;

    // When collapsed state is toggled
    const collapsed = toggleGroupCollapsed(expanded);

    // Then the group is collapsed (true)
    expect(collapsed).toBe(true);

    // When collapsed state is toggled again
    const expandedAgain = toggleGroupCollapsed(collapsed);

    // Then the group is expanded (false)
    expect(expandedAgain).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// STALENESS TRANSITION
// ---------------------------------------------------------------------------

describe("Stale session moves from Active to Recent group", () => {
  it("session beyond 5-min staleness threshold moves to recent", () => {
    // Given session "norbert" has isActive = false (set by buildTableRows
    // when last_event_at was 6 minutes ago, beyond staleness threshold)
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "norbert", isActive: false }),
      makeRow({ sessionId: "fresh", isActive: true }),
    ];

    // When rows are grouped
    const grouped = groupSessionRows(rows);

    // Then "norbert" appears in the recent group, not the active group
    expect(grouped.recent.map((r) => r.sessionId)).toContain("norbert");
    expect(grouped.active.map((r) => r.sessionId)).not.toContain("norbert");
    // And "fresh" appears in the active group
    expect(grouped.active.map((r) => r.sessionId)).toContain("fresh");
  });
});

// ---------------------------------------------------------------------------
// ERROR PATHS
// ---------------------------------------------------------------------------

describe("No active sessions shows empty Active group", () => {
  it("all completed sessions produces empty active group", () => {
    // Given 5 sessions, all completed (isActive = false)
    const rows: readonly TableRow[] = Array.from({ length: 5 }, (_, i) =>
      makeRow({ sessionId: `r${i}`, isActive: false }),
    );

    // When rows are grouped
    const grouped = groupSessionRows(rows);

    // Then the active group is empty (count 0)
    expect(grouped.activeCount).toBe(0);
    expect(grouped.active).toHaveLength(0);
    // And the recent group contains all 5 sessions
    expect(grouped.recentCount).toBe(5);
    expect(grouped.recent).toHaveLength(5);
  });
});

describe("No recent sessions when filter shows only active", () => {
  it("active-only filter produces empty recent group", () => {
    // Given 2 active sessions and no completed sessions pass the filter
    const rows: readonly TableRow[] = [
      makeRow({ sessionId: "a1", isActive: true }),
      makeRow({ sessionId: "a2", isActive: true }),
    ];

    // When rows are grouped
    const grouped = groupSessionRows(rows);

    // Then the active group contains 2 rows
    expect(grouped.activeCount).toBe(2);
    expect(grouped.active).toHaveLength(2);
    // And the recent group is empty
    expect(grouped.recentCount).toBe(0);
    expect(grouped.recent).toHaveLength(0);
  });
});
