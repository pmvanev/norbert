/**
 * Acceptance tests: Session Metrics Table — Sorting
 *
 * Validates column-based sorting behavior: ascending/descending toggle,
 * default sort order, sort persistence across data updates, and
 * graceful handling of missing metrics.
 *
 * Driving ports:
 *   - sortTableRows(rows, columnId, direction) -> TableRow[]
 *   - applySortToggle(currentSort, columnId) -> SortState
 *
 * Traces to: Milestone 1 — Sorting
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// PLACEHOLDER: imports will target production driving ports once implemented
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DEFAULT SORT
// ---------------------------------------------------------------------------

describe("Default sort shows active sessions first, then most recent", () => {
  it.skip("active sessions sort above completed, each group ordered by recency", () => {
    // Given two active sessions started 5 and 15 minutes ago
    // And three completed sessions from 1 hour, 3 hours, and 1 day ago
    //
    // When table rows are built with default sort
    //
    // Then the first two rows are the active sessions (5m then 15m)
    // And the next three rows are completed sessions (1h, 3h, 1d)
  });
});

// ---------------------------------------------------------------------------
// ASCENDING / DESCENDING TOGGLE
// ---------------------------------------------------------------------------

describe("Sort sessions by cost ascending", () => {
  it.skip("clicking cost header sorts lowest to highest", () => {
    // Given rows with costs $0.08, $1.24, and $0.52
    //
    // When rows are sorted by cost ascending
    //
    // Then the order is $0.08, $0.52, $1.24
  });
});

describe("Sort sessions by cost descending on second click", () => {
  it.skip("clicking cost header again reverses to highest first", () => {
    // Given rows are currently sorted by cost ascending
    //
    // When sort toggle is applied to cost column
    //
    // Then the direction flips to descending
    // And the order becomes $1.24, $0.52, $0.08
  });
});

describe("Sort sessions by token count", () => {
  it.skip("token column sorts numerically, not lexicographically", () => {
    // Given rows with token counts 9300, 61000, and 142500
    //
    // When rows are sorted by tokens ascending
    //
    // Then order is 9300, 61000, 142500
  });
});

describe("Sort sessions by burn rate to find fastest consumers", () => {
  it.skip("descending burn rate puts highest consumer first", () => {
    // Given "norbert" has burn rate 150, "api-server" 12, "docs-site" 0
    //
    // When rows are sorted by burn rate descending
    //
    // Then "norbert" (150) appears first, "docs-site" (0) appears last
  });
});

describe("Sort sessions by context utilization", () => {
  it.skip("descending context sort surfaces sessions nearing compaction", () => {
    // Given "norbert" at 82% context, "api-server" at 15% context
    //
    // When rows are sorted by context descending
    //
    // Then "norbert" (82%) appears first
  });
});

describe("Sort sessions by duration", () => {
  it.skip("descending duration puts longest-running session first", () => {
    // Given sessions running for 2 min, 45 min, and 3 hours
    //
    // When rows are sorted by duration descending
    //
    // Then the 3-hour session appears first
  });
});

// ---------------------------------------------------------------------------
// SORT PERSISTENCE
// ---------------------------------------------------------------------------

describe("Sort persists when new session data arrives", () => {
  it.skip("updating a row value re-sorts without resetting to default", () => {
    // Given rows sorted by cost descending: $1.24, $0.52, $0.08
    //
    // When the $0.52 session updates to $0.60
    // And rows are re-sorted with the same sort state
    //
    // Then the order is $1.24, $0.60, $0.08
  });
});

// ---------------------------------------------------------------------------
// ERROR PATH: Missing metrics
// ---------------------------------------------------------------------------

describe("Sort handles sessions with missing metrics gracefully", () => {
  it.skip("sessions with no cost data sort as zero", () => {
    // Given "legacy" has sessionCost 0 (no API events yet)
    // And "norbert" has sessionCost $1.24
    //
    // When rows are sorted by cost ascending
    //
    // Then "legacy" (0) appears first, "norbert" ($1.24) appears second
  });
});
