/**
 * Acceptance tests: Session Metrics Table — Row Grouping
 *
 * Validates that sessions are grouped under "Active Sessions" and
 * "Recent Sessions" expandable headers based on activity status.
 *
 * Driving ports:
 *   - groupSessionRows(rows, now) -> GroupedRows { active: TableRow[], recent: TableRow[] }
 *   - isSessionActive from src/domain/status.ts
 *
 * Traces to: Milestone 3 — Grouping
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PLACEHOLDER: imports will target production driving ports once implemented
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BASIC GROUPING
// ---------------------------------------------------------------------------

describe("Sessions grouped under Active and Recent headers", () => {
  it.skip("active sessions grouped separately from completed sessions", () => {
    // Given two sessions are active (ended_at null, last event within 5 min)
    // And three sessions completed within the last hour
    //
    // When rows are grouped
    //
    // Then the active group contains 2 rows
    // And the recent group contains 3 rows
  });
});

describe("Active group header shows count of active sessions", () => {
  it.skip("group header includes the count of sessions in the group", () => {
    // Given four sessions are currently active
    //
    // When rows are grouped
    //
    // Then the active group count is 4
  });
});

// ---------------------------------------------------------------------------
// COLLAPSE / EXPAND
// ---------------------------------------------------------------------------

describe("User collapses and expands session groups", () => {
  it.skip("toggling group collapsed state hides/shows rows", () => {
    // Given group collapsed state starts as expanded (false)
    //
    // When collapsed state is toggled
    //
    // Then the group is collapsed (true)
    //
    // When collapsed state is toggled again
    //
    // Then the group is expanded (false)
  });
});

// ---------------------------------------------------------------------------
// STALENESS TRANSITION
// ---------------------------------------------------------------------------

describe("Stale session moves from Active to Recent group", () => {
  it.skip("session beyond 5-min staleness threshold moves to recent", () => {
    // Given session "norbert" has ended_at null
    // And last_event_at was 6 minutes ago
    //
    // When rows are grouped with current time
    //
    // Then "norbert" appears in the recent group, not the active group
  });
});

// ---------------------------------------------------------------------------
// ERROR PATHS
// ---------------------------------------------------------------------------

describe("No active sessions shows empty Active group", () => {
  it.skip("all completed sessions produces empty active group", () => {
    // Given 5 sessions, all with ended_at set
    //
    // When rows are grouped
    //
    // Then the active group is empty (count 0)
    // And the recent group contains all 5 sessions
  });
});

describe("No recent sessions when filter shows only active", () => {
  it.skip("active-only filter produces empty recent group", () => {
    // Given 2 active sessions and filter is "Active Now"
    // And no completed sessions pass the filter
    //
    // When rows are grouped
    //
    // Then the active group contains 2 rows
    // And the recent group is empty
  });
});
